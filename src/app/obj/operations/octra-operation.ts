import {HttpClient} from '@angular/common/http';
import {DomSanitizer} from '@angular/platform-browser';
import {Task} from '../tasks/index';
import {FileInfo} from '../fileInfo';
import {Operation} from './operation';
import {TaskState} from '../tasks/task';
import {ToolOperation} from './tool-operation';
import {UploadOperation} from './upload-operation';
import {AppSettings} from '../../shared/app.settings';
import {OHLanguageObject} from '../oh-config';

export class OCTRAOperation extends ToolOperation {
  protected operations: Operation[];
  public resultType = 'BAS Partitur Format';

  public constructor(name: string, commands: string[], title?: string, shortTitle?: string, task?: Task, state?: TaskState, id?: number) {
    super(name, commands, title, shortTitle, task, state, id);
    this._description = 'A literal transcript contains the verbatim text of a speech recording.' +
      'These transcripts are either generated by Automatic Speech Recognition or they are created manually from scratch.' +
      'The editor Octra allows you to correct or create such transcripts.';
  }

  public start = (languageObject: OHLanguageObject, inputs: FileInfo[], operations: Operation[], httpclient: HttpClient) => {
    this._protocol = '';
    this.operations = operations;
    this.changeState(TaskState.READY);
  }

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
        result = '<i class="fa fa-cog fa-spin link" aria-hidden="true"></i>';
        break;
      case(TaskState.FINISHED):
        result = '<i class="fa fa-check" aria-hidden="true"></i>';
        break;
      case(TaskState.READY):
        result = '<i class="fa fa-pencil-square-o link" aria-hidden="true"></i>';
        break;
      case(TaskState.ERROR):
        result = '<i class="fa fa-times" aria-hidden="true"></i>';
        break;
    }

    return sanitizer.bypassSecurityTrustHtml(result);
  }

  public getStateIcon2 = () => {
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
        result = '<i class="fa fa-cog fa-spin link" aria-hidden="true"></i>';
        break;
      case(TaskState.FINISHED):
        result = '<i class="fa fa-check" aria-hidden="true"></i>';
        break;
      case(TaskState.READY):
        result = '<i class="fa fa-pencil-square-o link" aria-hidden="true"></i>';
        break;
      case(TaskState.ERROR):
        result = '<i class="fa fa-times" aria-hidden="true"></i>';
        break;
    }

    return result;
  }

  public getToolURL(): string {
    if (!((<UploadOperation>this.operations[0]).wavFile === null || (<UploadOperation>this.operations[0]).wavFile === undefined)) {
      const audio = `audio=${encodeURIComponent((<UploadOperation>this.operations[0]).wavFile.url)}`;
      let transcript = `transcript=`;
      const embedded = `embedded=1`;

      const langObj = AppSettings.getLanguageByCode(this.task.language, this.task.asr);

      if (!(langObj === null || langObj === undefined)) {
        const host = `host=${encodeURIComponent(langObj.host)}`;

        if (this.results.length < 1) {
          if (this.previousOperation.results.length > 0) {
            const url = this.previousOperation.lastResult.url;
            transcript += encodeURIComponent(url);
          } else if (this.previousOperation.previousOperation.results.length > 1) {
            const url = this.previousOperation.previousOperation.lastResult.url;
            transcript += encodeURIComponent(url);
          } else {
            transcript = '';
          }
        } else {
          const url = this.lastResult.url;
          transcript += encodeURIComponent(url);
        }

        return `${this._commands[0]}/user/load?` +
          `${audio}&` +
          `${transcript}&` +
          `${host}&` +
          `${embedded}`;
      } else {
        console.log(`langObj not found in octra operation lang:${this.task.language} and ${this.task.asr}`);
      }
    }
    return '';
  }

  public onMouseOver() {
  }

  public fromAny(operationObj: any, commands: string[], task: Task): OCTRAOperation {
    const result = new OCTRAOperation(operationObj.name, commands, this.title,
      this.shortTitle, task, operationObj.state, operationObj.id);
    for (let k = 0; k < operationObj.results.length; k++) {
      const resultObj = operationObj.results[k];
      const resultClass = FileInfo.fromAny(resultObj);
      result.results.push(resultClass);
    }
    result._time = operationObj.time;
    result._protocol = operationObj.protocol;
    result.operations = task.operations;
    result.enabled = operationObj.enabled;
    return result;
  }

  public clone(task?: Task): OCTRAOperation {
    const selected_task = ((task === null || task === undefined)) ? this.task : task;
    return new OCTRAOperation(this.name, this._commands, this.title, this.shortTitle, selected_task, this.state);
  }
}
