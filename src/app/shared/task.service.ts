import {HttpClient} from '@angular/common/http';
import {EventEmitter, Injectable, OnDestroy} from '@angular/core';
import {isNullOrUndefined} from 'util';
import {NotificationService} from './notification.service';
import {SubscriptionManager} from './subscription-manager';
import {ASROperation, EmuOperation, Operation, Task, TaskState} from '../obj/tasks';
import {OCTRAOperation} from '../obj/tasks/octra-operation';
import {UploadOperation} from '../obj/tasks/upload-operation';
import {G2pMausOperation} from '../obj/tasks/g2p-maus-operation';
import {TaskList} from '../obj/TaksList';
import {FileInfo} from '../obj/fileInfo';
import {DirectoryInfo} from '../obj/directoryInfo';
import {TaskDirectory} from '../obj/taskDirectory';

@Injectable()
export class TaskService implements OnDestroy {
  get protocol_array(): any[] {
    return this._protocol_array;
  }

  get warnings_count(): number {
    return this._warnings_count;
  }

  get errors_count(): number {
    return this._errors_count;
  }

  private options = {
    max_running_tasks: 3
  };
  private subscrmanager: SubscriptionManager = new SubscriptionManager();

  private _errors_count = 0;
  private _warnings_count = 0;
  private _protocol_array = [];

  public errorscountchange = new EventEmitter<number>();

  private state: TaskState = TaskState.READY;

  constructor(public httpclient: HttpClient, private notification: NotificationService) {
    this._operations = [
      new UploadOperation('Upload', '<i class="fa fa-upload" aria-hidden="true"></i>'),
      new ASROperation('ASR', '<i class="fa fa-forward" aria-hidden="true"></i>'),
      // new ToolOperation('OCTRA'),
      new OCTRAOperation('OCTRA'),
      new G2pMausOperation('MAUS'),
      new EmuOperation('Emu WebApp')
    ];
  }

  private _taskList: TaskList = new TaskList();

  get taskList(): TaskList {
    return this._taskList;
  }

  private _operations: Operation[] = [];

  get operations(): Operation[] {
    return this._operations;
  }

  public addEntry(entry: (Task | TaskDirectory)) {
    if (entry instanceof Task || entry instanceof TaskDirectory) {
      this.taskList.addEntry(entry);
    } else {
      console.error(`could not add Task or TaskDirectory. Invalid class instance`);
    }
    console.log(this.taskList);
  }

  public start() {
    console.log(`Start service!`);
    // look for pending tasks

    let running_tasks = this.countRunningTasks();
    if (running_tasks < this.options.max_running_tasks) {
      let task: Task;

      // look for pending tasks
      task = this._taskList.findTaskByState(TaskState.PENDING);

      if (!isNullOrUndefined(task) && this.countPendingTasks() > 0) {
        if (this.state !== TaskState.PROCESSING) {
          this.state = TaskState.READY;
        }

        this.subscrmanager.add(task.opstatechange.subscribe((event) => {
          const operation = task.getOperationByID(event.opID);
          const opName = operation.name;
          if (opName === 'ASR' && event.newState === TaskState.FINISHED) {
            this.notification.showNotification('ASR Operation successful', 'You can now edit it with OCTRA');
          } else if (event.newState === TaskState.ERROR) {
            this.notification.showNotification(opName + ' Operation failed', 'Please click on "Errors" on the status bar');
          } else if (opName === 'MAUS' && event.newState === TaskState.FINISHED) {
            this.notification.showNotification('MAUS Operation successful', 'You can now edit it with EMU WebApp');
          }

          if (event.oldState === TaskState.UPLOADING && event.newState === TaskState.FINISHED) {
            this.start();
          }
          running_tasks = this.countRunningTasks();
          this.updateProtocolArray();
          const lastOp = task.operations[task.operations.length - 1];
          if (running_tasks > 1 || (running_tasks === 1 && (lastOp.state !== TaskState.FINISHED && lastOp.state !== TaskState.READY))) {
            if (operation.state === TaskState.UPLOADING) {
              this.state = TaskState.UPLOADING;
            } else {
              this.state = TaskState.PROCESSING;
            }
          } else {
            this.state = TaskState.READY;
          }
        }));
        task.start(this.httpclient);

        console.log(`${this.state.valueOf()} === ${TaskState.UPLOADING.valueOf()}`);
      }
    } else {
      console.log(running_tasks + ' running tasks');
      setTimeout(() => {
        this.start();
      }, 1000);
    }
  }

  public countRunningTasks() {
    let result = 0;
    let tasks = this._taskList.getAllTasks();

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];

      if (task.state === TaskState.PROCESSING || task.state === TaskState.UPLOADING) {
        result++;
      }
    }

    return result;
  }

  public countPendingTasks() {
    let result = 0;
    let tasks = this._taskList.getAllTasks();

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];

      if (task.state === TaskState.PENDING) {
        result++;
      }
    }

    return result;
  }

  ngOnDestroy() {
    let tasks = this._taskList.getAllTasks();

    for (let i = 0; i < tasks.length; i++) {
      tasks[i].destroy();
    }
    this.subscrmanager.destroy();
  }

  public updateProtocolArray() {
    let result = [];
    let errors_count = 0;
    let warnings_count = 0;

    console.log(`check states`);
    // TODO implement error and warning attributes in TaskList to improve performance
    let tasks = this._taskList.getAllTasks();

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];

      for (let j = 0; j < task.operations.length; j++) {
        const operation = task.operations[j];

        if ((operation.state === TaskState.FINISHED || operation.state === TaskState.ERROR) && operation.protocol !== '') {
          if (operation.state === TaskState.ERROR) {
            errors_count++;
          } else {
            warnings_count++;
          }

          result.push(
            {
              task_id: task.id,
              op_name: operation.name,
              state: operation.state,
              protocol: operation.protocol
            }
          );
        }
      }
    }

    if (this.errors_count !== errors_count) {
      this.errorscountchange.emit(this.errors_count);
    }
    this._errors_count = errors_count;
    this._warnings_count = warnings_count;

    // sort protocol_array by task id
    result = result.sort((a, b) => {
      if (a.task_id > b.task_id) {
        return 1;
      } else if (a.task_id < b.task_id) {
        return -1;
      }
      return 0;
    });

    this._protocol_array = result;
  }

  public cleanUpInputArray(entries: (FileInfo | DirectoryInfo)[]): (FileInfo | DirectoryInfo)[] {
    let result: (FileInfo | DirectoryInfo)[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      if (entry instanceof FileInfo) {
        let file = <FileInfo> entry;
        if (file.extension === 'wav') {
          result.push(file);
        }

      } else if (entry instanceof DirectoryInfo) {
        let directory = <DirectoryInfo> entry;

        let dir = directory.clone();
        dir.entries = dir.entries.filter((a) => {
          return a instanceof FileInfo && a.extension === 'wav';
        });
        let rest = directory.entries.filter((a) => {
          return a instanceof DirectoryInfo;
        });

        if (dir.entries.length > 0) {
          result.push(dir);
        }
        result = result.concat(this.cleanUpInputArray(rest));
      }
    }

    return result;
  }
}