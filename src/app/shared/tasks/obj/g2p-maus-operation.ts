import {HttpClient} from '@angular/common/http';
import {isNullOrUndefined} from 'util';
import * as X2JS from 'x2js';
import {FileInfo} from './fileInfo';
import {Task} from './index';
import {Operation} from './operation';
import {TaskState} from './task';

export class G2pMausOperation extends Operation {

  public constructor(name: string, icon?: string, task?: Task, state?: TaskState) {
    super(name, icon, task, state);
  }

  public start = (inputs: FileInfo[], operations: Operation[], httpclient: HttpClient) => {
    this.changeState(TaskState.PROCESSING);
    this._time.start = Date.now();
    this._time.end = 0;

    const url = 'https://clarin.phonetik.uni-muenchen.de/BASWebServices/services/runPipelineWebLink?' +
      'TEXT=' + operations[2].results[0].url +
      '&SIGNAL=' + inputs[0].url + '&' +
      'PIPE=G2P_MAUS&LANGUAGE=' + this.task.language + '&' +
      'MAUSVARIANT=runPipeline&OUTFORMAT=emuDB';

    httpclient.post(url, {}, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      responseType: 'text'
    }).subscribe((result: string) => {
        this._time.end = Date.now();

        // convert result to json
        const x2js = new X2JS();
        let json: any = x2js.xml2js(result);
        json = json.WebServiceResponseLink;

        // add messages to protocol
        if (json.warnings !== '') {
          this._protocol = json.warnings;
        } else if (json.output !== '') {
          this._protocol = json.output;
        }

        if (json.success === 'true') {
          this.results.push(FileInfo.fromURL(json.downloadLink, inputs[0].name));
          this.changeState(TaskState.FINISHED);
        } else {
          this.changeState(TaskState.ERROR);
        }
      },
      (error) => {
        this._protocol = error.message;
        this.changeState(TaskState.ERROR);
      });

    /*
        // simulate upload
        setTimeout(() => {
          this.time.end = Date.now();
          const url = 'https://clarin.phonetik.uni-muenchen.de/BASWebServices/data/2018.01.08_23.22.25_9BACC305ADBB2F90FBCBC91D564354C6/test_annot.json';
          this.results.push(FileInfo.fromURL(url));
          this.changeState(TaskState.FINISHED);
        }, 2000);
      */
  };

  public clone(task?: Task): G2pMausOperation {
    const selected_task = (isNullOrUndefined(task)) ? this.task : task;
    return new G2pMausOperation(this.name, this.icon, selected_task, this.state);
  }
}