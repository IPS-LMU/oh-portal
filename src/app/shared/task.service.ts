import {HttpClient} from '@angular/common/http';
import {EventEmitter, Injectable, OnDestroy} from '@angular/core';
import {isNullOrUndefined} from 'util';
import {NotificationService} from './notification.service';
import {SubscriptionManager} from './subscription-manager';
import {Task, TaskDirectory, TaskList, TaskState} from '../obj/tasks';
import {OCTRAOperation} from '../obj/tasks/octra-operation';
import {UploadOperation} from '../obj/tasks/upload-operation';
import {G2pMausOperation} from '../obj/tasks/g2p-maus-operation';
import {FileInfo} from '../obj/fileInfo';
import {DirectoryInfo} from '../obj/directoryInfo';
import {StorageService} from '../storage.service';
import {Preprocessor, QueueItem} from '../obj/preprocessor';
import {WavFormat} from '../obj/audio/AudioFormats';
import {AudioInfo} from '../obj/audio';
import {AppInfo} from '../app.info';
import {TaskEntry} from '../obj/tasks/task-entry';
import {ASROperation} from '../obj/tasks/asr-operation';
import {EmuOperation} from '../obj/tasks/emu-operation';
import {Operation} from '../obj/tasks/operation';
import * as moment from 'moment';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';

@Injectable()
export class TaskService implements OnDestroy {
  set splitPrompt(value: string) {
    this._splitPrompt = value;
  }

  get splitPrompt(): string {
    return this._splitPrompt;
  }

  get preprocessor(): Preprocessor {
    return this._preprocessor;
  }

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
  private _splitPrompt = 'PENDING';

  public protocolURL: SafeResourceUrl;
  public protocolFileName = '';

  public errorscountchange = new EventEmitter<number>();

  public selectedlanguage = AppInfo.languages[0];
  private state: TaskState = TaskState.READY;

  private _preprocessor: Preprocessor = new Preprocessor();

  constructor(public httpclient: HttpClient, private notification: NotificationService, private storage: StorageService, private sanitizer: DomSanitizer) {
    this._operations = [
      new UploadOperation('Upload', '<i class="fa fa-upload" aria-hidden="true"></i>'),
      new ASROperation('ASR', '<i class="fa fa-forward" aria-hidden="true"></i>'),
      // new ToolOperation('OCTRA'),
      new OCTRAOperation('OCTRA'),
      new G2pMausOperation('MAUS'),
      new EmuOperation('Emu WebApp')
    ];

    this._preprocessor.process = this.process;

    this.subscrmanager.add(this._preprocessor.itemProcessed.subscribe(
      (item) => {
        for (let i = 0; i < item.results.length; i++) {
          const result = item.results[i];
          this.addEntry(result);
          this.storage.saveTask(result);
        }
      }
    ));

    this.subscrmanager.add(this.storage.allloaded.subscribe((IDBtasks) => {
      if (!isNullOrUndefined(IDBtasks)) {
        this.newfiles = IDBtasks.length > 0;

        for (let i = 0; i < IDBtasks.length; i++) {
          const taskObj = IDBtasks[i];
          if (taskObj.type === 'task') {
            const task = Task.fromAny(taskObj, this.operations);
            this._taskList.addEntry(task);
          } else {
            const taskDir = TaskDirectory.fromAny(taskObj, this.operations);
            this._taskList.addEntry(taskDir);
          }
        }
        this.protocolURL = this.updateProtocolURL();
      }
    }))
  }

  private _taskList: TaskList = new TaskList();

  get taskList(): TaskList {
    return this._taskList;
  }

  private _operations: Operation[] = [];
  public newfiles = false;

  get operations(): Operation[] {
    return this._operations;
  }

  public addEntry(entry: (Task | TaskDirectory)) {
    if (entry instanceof Task || entry instanceof TaskDirectory) {
      this.taskList.addEntry(entry);
      this.storage.saveCounter('taskCounter', TaskEntry.counter);
      this.storage.saveCounter('operationCounter', Operation.counter);
    } else {
      console.error(`could not add Task or TaskDirectory. Invalid class instance`);
    }
  }

  public start() {
    console.log(`Start service!`);
    // look for pending tasks

    let running_tasks = this.countRunningTasks();
    if (running_tasks < this.options.max_running_tasks) {
      let task: Task;

      // look for pending tasks
      task = this.findNextWaitingTask();

      if (!isNullOrUndefined(task)) {
        if (this.state !== TaskState.PROCESSING) {
          this.state = TaskState.READY;
        }

        task.statechange.subscribe((obj) => {
          console.log(`task change!`);
          console.log(`from ${obj.oldState} to ${obj.newState}`);
          this.storage.saveTask(task);
          this.protocolURL = this.updateProtocolURL();
        });
        console.log(`found task with id ${task.id}`);
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
          this.storage.saveTask(task);
          this.protocolURL = this.updateProtocolURL();
        }));
        this.storage.saveTask(task);
        task.start(this.httpclient);
        setTimeout(() => {
          this.start();
        }, 1000);
      } else {
        console.log(`no free tasks found`);
      }
    } else {
      setTimeout(() => {
        this.start();
      }, 1000);
    }
  }

  public findNextWaitingTask(): Task {
    const tasks = this.taskList.getAllTasks();
    for (let i = 0; i < tasks.length; i++) {
      const entry = tasks[i];
      if (entry.state === TaskState.PENDING) {
        return entry;
      } else if (entry.state === TaskState.READY) {
        for (let j = 0; j < entry.operations.length; j++) {
          const operation = entry.operations[j];
          if ((operation.state === TaskState.PENDING || operation.state === TaskState.READY) && operation.name !== 'OCTRA') {
            return entry;
          } else if (operation.state !== TaskState.FINISHED && operation.name === 'OCTRA') {
            break;
          }
        }
      }
    }

    return null;
  }

  public updateProtocolURL() {
    const results = [];

    for (let i = 0; i < this.taskList.entries.length; i++) {
      const entry = this.taskList.entries[i];
      results.push(entry.toAny());
    }

    const json = {
      version: '1.0.0',
      encoding: 'UTF-8',
      created: moment.defaultFormatUtc,
      entries: results
    };

    this.protocolFileName = 'oh_portal_' + Date.now() + '.json';
    const file = new File([JSON.stringify(json)], this.protocolFileName, {
      'type': 'text/plain'
    });

    return this.sanitizer.bypassSecurityTrustResourceUrl(URL.createObjectURL(file));
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
          return a instanceof FileInfo && (a.extension === 'wav');
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

  public process: (queueItem: QueueItem) => Promise<(Task | TaskDirectory)[]> = (queueItem: QueueItem) => {

    if (queueItem.file instanceof FileInfo) {
      let file = <FileInfo> queueItem.file;
      return this.processFileInfo(file, '', queueItem);
    } else if (queueItem.file instanceof DirectoryInfo) {
      let dir = <DirectoryInfo> queueItem.file;
      return this.processDirectoryInfo(dir, queueItem);
    }
  };

  private processFileInfo(file: FileInfo, path: string, queueItem: QueueItem): Promise<(Task | TaskDirectory)[]> {
    return new Promise<(Task | TaskDirectory)[]>((resolve, reject) => {
      const newName = FileInfo.escapeFileName(file.fullname);
      let newFileInfo: FileInfo = null;

      new Promise<void>((res) => {
          if (newName !== file.name) {
            // no valid name, replace
            FileInfo.renameFile(file.file, newName, {
              type: file.type,
              lastModified: file.file.lastModifiedDate
            }).then((newfile: File) => {
              newFileInfo = new FileInfo(newfile.name, newfile.type, newfile.size, newfile);
              newFileInfo.attributes = queueItem.file.attributes;
              res();
            });
          } else {
            res();
          }
        }
      ).then(() => {
        this.newfiles = true;

        setTimeout(() => {
          let reader = new FileReader();
          reader.onload = (event: any) => {
            const format = new WavFormat(event.target.result);
            const isValidFormat = format.isValid(event.target.result);
            if (isValidFormat && format.channels > 1) {

              const directory = new DirectoryInfo(path + file.name + '_dir/');

              const files: File[] = format.splitChannelsToFiles(file.name, 'audio/wav', event.target.result);


              if (this._splitPrompt === 'PENDING') {
                this.openSplitModal();
                this._splitPrompt = 'ASKED';
              } else if (this._splitPrompt !== 'ASKED') {
                if (this._splitPrompt === 'FIRST') {
                  files.splice(1, 1);
                } else if (this._splitPrompt === 'SECOND') {
                  files.splice(0, 1);
                }
              }

              const fileInfos: FileInfo[] = [];

              if (files.length > 1) {
                for (let i = 0; i < files.length; i++) {
                  const fileObj = files[i];
                  const fileInfo = FileInfo.fromFileObject(fileObj);

                  fileInfos.push(fileInfo);
                }
                directory.addEntries(fileInfos);
                this.processDirectoryInfo(directory, queueItem).then((result) => {
                  resolve(result);
                }).catch((err) => {
                  reject(err);
                });
              } else {
                this.processFileInfo(FileInfo.fromFileObject(files[0]), path, queueItem).then(resolve).catch(reject);
              }

            } else if (isValidFormat) {
              newFileInfo = new AudioInfo(
                newName, file.file.type, file.file.size, format.sampleRate,
                format.duration, format.channels, format.bitsPerSample, newFileInfo.file
              );

              if (isNullOrUndefined(newFileInfo.file)) {
                newFileInfo.file = file.file;
              }

              newFileInfo.attributes = file.attributes;
              queueItem.file = newFileInfo;

              const task = new Task([<FileInfo> queueItem.file], this.operations);
              task.language = this.selectedlanguage.code;

              // set state
              for (let i = 0; i < this.operations.length; i++) {
                const operation = this.operations[i];

                task.operations[i].enabled = operation.enabled;
              }

              resolve([task]);
            } else {
              reject('no valid wave format!');
            }
          };
          reader.readAsArrayBuffer(file.file);
        }, 1000);
      });
    });
  }

  private processDirectoryInfo(dir: DirectoryInfo, queueItem: QueueItem): Promise<TaskDirectory[]> {
    return new Promise<TaskDirectory[]>((resolve, reject) => {

      let dirTask = new TaskDirectory(dir.path, dir.size);
      const promises: Promise<(Task | TaskDirectory)[]>[] = [];

      for (let i = 0; i < dir.entries.length; i++) {
        const dirEntry = dir.entries[i];

        if (dirEntry instanceof FileInfo) {
          const file = <FileInfo> dirEntry;

          promises.push(this.processFileInfo(file, dir.path, queueItem));

        } else {
          console.error('file in dir is not a file!');
        }
      }

      Promise.all(promises).then((values) => {
        const result = [];

        let content = [];

        values = [].concat.apply([], values);
        for (let k = 0; k < values.length; k++) {
          const value = values[k];

          if (value instanceof Task) {
            // set state
            for (let i = 0; i < this.operations.length; i++) {
              const operation = this.operations[i];
              value.operations[i].enabled = operation.enabled;
            }
            content.push(value);
          } else if (value instanceof TaskDirectory) {
            // is dir
            if (value.entries.length === 1) {
              content.push(value.entries[0]);
            } else {
              if (content.length > 0) {
                dirTask.addEntries(content);
                result.push(dirTask);
                content = [];
              }

              result.push(value);
            }
          }
        }
        if (content.length > 0) {
          dirTask.addEntries(content);
          result.push(dirTask);
        }

        resolve(result);
      });
    });
  }

  public openSplitModal = () => {

  }
}
