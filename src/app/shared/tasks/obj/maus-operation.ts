import { HttpClient } from '@angular/common/http';
import * as X2JS from 'x2js';
import { FileInfo } from './fileInfo';
import { Operation } from './operation';
import { TaskState } from './task';

export class MAUSOperation extends Operation {

  public constructor(name: string, icon?: string, state?: TaskState) {
    super(name, icon, state);
  }

  public start = (inputs: FileInfo[], operations: Operation[], httpclient: HttpClient) => {
    this.changeState(TaskState.PROCESSING);
    this._time.start = Date.now();
    try {
      console.log('results');
      console.log(operations[ 1 ].results);
      const url = 'https://clarin.phonetik.uni-muenchen.de/BASWebServices/services/runMAUSWebLink?' +
        'BPF=' + operations[ 1 ].results[ 0 ].url +
        '&SIGNAL=' + inputs[ 0 ].url +
        '&LANGUAGE=deu-DE' +
        '&OUTFORMAT=emuDB&MAUSVARIANT=runMAUS';

      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);

      xhr.onloadstart = (e) => {
        console.log('start');
      };

      xhr.onerror = (e) => {
        console.error(e);
        // add messages to protocol
        this._protocol = e.message;

        this.changeState(TaskState.ERROR);
      };

      xhr.onloadend = (e) => {
        const result = e.currentTarget[ 'responseText' ];
        const x2js = new X2JS();
        let json: any = x2js.xml2js(result);
        json = json.WebServiceResponseLink;
        console.log(json);


        if (json.success === 'true') {
          this.time.end = Date.now();
          this.changeState(TaskState.FINISHED);
        } else {
          this.changeState(TaskState.ERROR);
          console.error(json[ 'message' ]);
        }
        // add messages to protocol
        if (json.warnings !== '') {
          this._protocol = json.warnings;
        }
      };
      xhr.send();
    } catch (e) {
      this._protocol = e.message;
      this.changeState(TaskState.ERROR);
    }
  };

  public clone(): MAUSOperation {
    return new MAUSOperation(this.name, this.icon, this.state);
  }
}
