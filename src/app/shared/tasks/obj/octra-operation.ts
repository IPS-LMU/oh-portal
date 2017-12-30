import {HttpClient} from '@angular/common/http';
import {DomSanitizer} from '@angular/platform-browser';
import {isNullOrUndefined} from 'util';
import {Task} from './';
import {FileInfo} from './fileInfo';
import {Operation} from './operation';
import {TaskState} from './task';
import {ToolOperation} from './tool-operation';

export class OCTRAOperation extends ToolOperation {
  private operations: Operation[];

  public constructor(name: string, icon?: string, task?: Task, state?: TaskState) {
    super(name, icon, task, state);
  }

  public start = (inputs: FileInfo[], operations: Operation[], httpclient: HttpClient) => {
    this._time.start = Date.now();
    this.operations = operations;
    this.changeState(TaskState.PROCESSING);
  };

  public getStateIcon = (sanitizer: DomSanitizer) => {
    let result = '';

    switch (this.state) {
      case(TaskState.PENDING):
        result = ``;
        break;
      case(TaskState.UPLOADING):
        result = '<i class="fa fa-spinner fa-spin fa-fw"></i>\n' +
          '<span class="sr-only">Loading...</span>';
        break;
      case(TaskState.PROCESSING):
        result = '<i class="fa fa-pencil-square-o link" aria-hidden="true"></i>';
        break;
      case(TaskState.FINISHED):
        result = '<i class="fa fa-check" aria-hidden="true"></i>';
        break;
      case(TaskState.READY):
        result = '<a href="#"><i class="fa fa-pencil-square-o" aria-hidden="true"></i></a>';
        break;
      case(TaskState.ERROR):
        result = '<i class="fa fa-times" aria-hidden="true"></i>';
        break;
    }

    return sanitizer.bypassSecurityTrustHtml(result);
  };

  public getToolURL(): string {
    const audio = encodeURIComponent(this.operations[0].results[0].url);
    const transcript = encodeURIComponent(this.operations[1].results[0].url);

    return `https://www.phonetik.uni-muenchen.de/apps/octra/octra-dev/user/load?` +
      `audio=${audio}&` +
      `transcript=${transcript}&` +
      `embedded=1`;
  }

  public clone(task?: Task): OCTRAOperation {
    const selected_task = (isNullOrUndefined(task)) ? this.task : task;
    return new OCTRAOperation(this.name, this.icon, selected_task, this.state);
  }
}
