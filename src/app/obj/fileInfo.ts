import {DataInfo} from './dataInfo';
import {unescape} from 'querystring';
import {HttpClient} from '@angular/common/http';
import {isUnset} from '@octra/utilities';

export class FileInfo extends DataInfo {
  public constructor(fullname: string, type: string, size: number, file?: File, createdAt?: number) {
    super(FileInfo.extractFileName(fullname).name, type, size);
    this._createdAt = (isUnset(createdAt)) ? 0 : createdAt;

    const extraction = FileInfo.extractFileName(fullname);
    if (!(extraction === null || extraction === undefined)) {
      this._extension = extraction.extension;
      this._file = file;
    } else {
      throw Error('could not extract file name.');
    }
  }

  /**
   * returns if the file is ready for processing
   */
  get available(): boolean {
    return this.online || !(this._file === undefined || this._file === null);
  }

  public get createdAt(): number {
    return this._createdAt;
  }

  private _createdAt = 0;

  public get fullname(): string {
    return `${this._name}${this._extension}`;
  }

  public set fullname(value: string) {
    const point = value.lastIndexOf('.');
    const str1 = value.substr(0, point);
    const str2 = value.substr(point + 1);
    this._name = str1;
    this._extension = str2;
  }

  protected _extension: string;

  /**
   * extension including the dot. (this must contain a dot!)
   */
  get extension(): string {
    return this._extension;
  }

  protected _file: File;

  get file(): File {
    return this._file;
  }

  set file(value: File) {
    this._file = value;
  }

  protected _url: string;

  get url(): string {
    return this._url;
  }

  set url(value: string) {
    this._url = value;
  }

  private _online = true;

  get online(): boolean {
    return this._online;
  }

  set online(value: boolean) {
    this._online = value;
  }

  public static fromFileObject(file: File) {
    return new FileInfo(file.name, file.type, file.size, file, file.lastModified);
  }

  public static fromURL(url: string, name: string = null, type: string, createdAt = 0) {
    let fullname = '';
    if (name != null) {
      const extension = url.substr(url.lastIndexOf('.') + 1);
      fullname = name + '.' + extension;
    } else {
      fullname = url.substr(url.lastIndexOf('/') + 1);
    }
    const result = new FileInfo(fullname, type, 0, undefined, createdAt);
    result.url = url;

    return result;
  }

  public static escapeFileName(name: string) {
    return name.replace(/[\s\/?!%*()[\]{}&:=+#'<>^;,Ââ°]/g, '_');
  }

  public static renameFile(file: File, newName: string, attributes: any): Promise<File> {
    return new Promise<File>(
      (resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (result: any) => {
          resolve(new File([result.target.result], newName, attributes));
        };
        reader.onerror = (error) => {
          reject(error);
        };

        reader.readAsArrayBuffer(file);
      }
    );
  }

  public static extractFileName(fullname: string): { name: string, extension: string } {
    if (!(fullname === null || fullname === undefined) && fullname !== '') {
      const lastSlash = fullname.lastIndexOf('/');
      if (lastSlash > -1) {
        // if path remove all but the filename
        fullname = fullname.substr(lastSlash + 1);
      }

      const extensionBegin = fullname.lastIndexOf('.');
      if (extensionBegin > -1) {
        // split name and extension
        const name = fullname.substr(0, extensionBegin);
        const extension = fullname.substr(extensionBegin);

        return {
          name,
          extension
        };
      } else {
        throw new Error('invalid fullname. Fullname must contain the file extension');
      }
    }

    return null;
  }

  public static fromAny(object: any): FileInfo {
    let file;
    if (object.content !== undefined && object.content !== '') {
      file = this.getFileFromContent(object.content, object.fullname, object.type, object.createdAt);
    }

    const result = new FileInfo(object.fullname, object.type, object.size, file, object.createdAt);
    result.attributes = object.attributes;
    result.url = object.url;
    return result;
  }

  public static getFileContent(file: File, encoding?: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsText(file, encoding);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }

  public static getFileFromContent(content: string, filename: string, type?: string, createdAt?: number): File {
    const properties = {
      lastModified: (isUnset(createdAt)) ? Date.now() : createdAt,
      type: (!isUnset(type)) ? type : ''
    };

    return new File([content], filename, properties);
  }


  public static getFileFromBase64(base64: string, filename: string) {
    // convert base64/URLEncoded data component to raw binary data held in a string
    let byteString;
    if (base64.split(',')[0].indexOf('base64') >= 0) {
      byteString = atob(base64.split(',')[1]);
    } else {
      byteString = unescape(base64.split(',')[1]);
    }

    // separate out the mime component
    const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];

    // write the bytes of the string to a typed array
    const ia = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }

    const blob = new Blob([ia], {type: mimeString});
    return new File([blob], filename, {type: mimeString});
  }

  public toAny(): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      const result = {
        fullname: this.fullname,
        size: this.size,
        type: this.type,
        url: this.url,
        attributes: this.attributes,
        createdAt: this._createdAt,
        content: ''
      };

      if (this._extension.indexOf('wav') < 0 && this._file !== undefined) {
        FileInfo.getFileContent(this._file).then(
          (content) => {
            result.content = content;
            resolve(result);
          }
        ).catch((err) => {
          reject(err);
        });
      } else {
        resolve(result);
      }
    });
  }

  public updateContentFromURL(httpClient: HttpClient): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this._url !== undefined && this._url !== null) {
        httpClient.get(this._url + `?d=${Date.now()}`, {
          responseType: 'text'
        }).subscribe(
          result => {
            this._file = FileInfo.getFileFromContent(result, this.fullname, this._type);
            this._size = this._file.size;
            resolve();
          },
          error => reject(error)
        );
      } else {
        reject(Error('URL of this file is invalid'));
      }
    });
  }


  getBase64(file: File): any {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }
}
