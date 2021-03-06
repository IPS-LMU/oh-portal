import {Observable} from 'rxjs';

export enum IDBMode {
  READONLY,
  READWRITE
}

export class IndexedDBManager {
  private indexedDB: IDBFactory;
  private readonly _idbtransaction: IDBTransaction;
  private idbkeyrange: IDBKeyRange;
  private readonly dbname: string;

  constructor(dbname: string) {
    this.dbname = dbname;

    if (!IndexedDBManager.isCompatible()) {
      console.error('Browser doesn\'t support a stable version of IndexedDB.');
    } else {
      this.indexedDB = window.indexedDB
        || (window as any).mozIndexedDB
        || (window as any).webkitIndexedDB
        || (window as any).msIndexedDB;

      this._idbtransaction = (window as any).IDBTransaction
        || (window as any).webkitIDBTransaction
        || (window as any).msIDBTransaction;

      this.idbkeyrange = (window as any).IDBKeyRange
        || (window as any).webkitIDBKeyRange
        || (window as any).msIDBKeyRange;
    }
  }

  get idbtransaction(): IDBTransaction {
    return this._idbtransaction;
  }

  private _db: IDBDatabase;

  get db(): IDBDatabase {
    return this._db;
  }

  /***
   * checks if browser supports indexedDB
   */
  public static isCompatible(): boolean {
    const indexedDB = (window as any).indexedDB
      || (window as any).mozIndexedDB
      || (window as any).webkitIndexedDB
      || (window as any).msIndexedDB;

    const idbtransaction = (window as any).IDBTransaction
      || (window as any).webkitIDBTransaction
      || (window as any).msIDBTransaction;

    const idbkeyrange = (window as any).IDBKeyRange
      || (window as any).webkitIDBKeyRange
      || (window as any).msIDBKeyRange;

    return (!((indexedDB === null || indexedDB === undefined)
      || (idbtransaction === null || idbtransaction === undefined)
      || (idbkeyrange === null || idbkeyrange === undefined)));
  }

  public open(version?: number): Observable<any> {
    const request = this.indexedDB.open(this.dbname, version);
    return Observable.create(observer => {
      request.onerror = (event: any) => {
        observer.error(event);
      };

      request.onsuccess = (event: any) => {
        this._db = event.target.result;
        observer.next(event);
        observer.complete();
      };

      request.onupgradeneeded = (event: any) => {
        this._db = event.target.result;
        observer.next(event);
      };

      request.onblocked = (event: any) => {
        observer.next(event);
      };
    });
  }

  public getObjectStore = (storeName: string, mode: IDBMode): IDBObjectStore => {
    let modeStr: IDBTransactionMode = 'readonly';

    if (mode === IDBMode.READWRITE) {
      modeStr = 'readwrite';
    }
    const txn = this.db.transaction([storeName], modeStr);
    return txn.objectStore(storeName);
  }

  public objectStoreExists = (storeName: string): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      const modeStr: IDBTransactionMode = 'readonly';

      const txn = this.db.transaction([storeName], modeStr);
      txn.onerror = () => {
        reject();
      };
      txn.oncomplete = () => {
        resolve();
      };
    });
  }

  public get = (storeName: string | IDBObjectStore, key: string | number): Promise<any> => {
    return new Promise<any>(
      (resolve, reject) => {
        const store = (typeof storeName !== 'string') ? storeName : this.getObjectStore(storeName, IDBMode.READONLY);
        if (key !== null && key !== undefined) {
          const request: IDBRequest = store.get(key);
          request.onsuccess = (idbrequest: any) => {
            resolve(idbrequest.target.result);
          };

          request.onerror = (error: any) => {
            reject(error);
          };
        } else {
          reject(new Error('key not defined'));
        }
      }
    );
  }

  public getAll = (storeName: string | IDBObjectStore): Promise<any[]> => {
    return new Promise<any>(
      (resolve, reject) => {
        const result = [];
        const store = (typeof storeName !== 'string') ? storeName : this.getObjectStore(storeName, IDBMode.READONLY);
        const cursorRequest = store.openCursor();

        cursorRequest.onsuccess = (event: any) => {
          const cursor = event.target.result;

          if (cursor) {
            const value = cursor.value;
            result.push(value);
            cursor.continue();
          } else {
            resolve(result);
          }
        };

        cursorRequest.onerror = (error: any) => {
          reject(error);
        };
      }
    );
  }

  public save = (storeName: string | IDBObjectStore, key, data): Promise<any> => {
    return new Promise<any>(
      (resolve, reject) => {
        try {
          const store = (typeof storeName !== 'string') ? storeName : this.getObjectStore(storeName, IDBMode.READWRITE);

          if (data === null || data === undefined) {
            data = {};
          }
          // make sure that key is in data object
          if (!data.hasOwnProperty(store.keyPath)) {
            data['' + store.keyPath + ''] = key;
          }
          const request = key ? store.put(data) : store.add(data);
          request.onsuccess = (result: any) => {
            resolve(result);
          };
          request.onerror = (error: any) => {
            reject(error);
          };
        } catch (error) {
          reject(error);
        }
      }
    );
  }

  public saveSequential = (storeName: string | IDBObjectStore, data: { key: string, value: any }[]): Promise<void> => {
    return new Promise<void>((resolve, reject) => {

      const wrapper = (acc: number) => {
        if (acc < data.length) {
          if (data[acc].hasOwnProperty('key') && data[acc].hasOwnProperty('value')) {
            return this.save(storeName, data[acc].key, data[acc].value).then(() => {
              wrapper(++acc);
            });
          } else {
            reject(new Error('saveSync data parameter has invalid elements'));
            }
          } else {
            resolve();
          }
        };

      wrapper(0);
      }
    );
  }

  public remove = (storeName: string | IDBObjectStore, key: string | number): Promise<any> => {
    return new Promise<any>(
      (resolve, reject) => {
        const store = (typeof storeName !== 'string') ? storeName : this.getObjectStore(storeName, IDBMode.READWRITE);
        const request = store.delete(key);
        request.onsuccess = (result: any) => {
          resolve(result);
        };

        request.onerror = (error: any) => {
          reject(error);
        };
      });
  }

  public clear = (storeName: string | IDBObjectStore): Promise<any> => {
    return new Promise<any>(
      (resolve, reject) => {
        const store = (typeof storeName !== 'string') ? storeName : this.getObjectStore(storeName, IDBMode.READWRITE);
        const request = store.clear();
        request.onsuccess = (result: any) => {
          resolve(result);
        };

        request.onerror = (error: any) => {
          reject(error);
        };
      });
  }

  public close = () => {
    this.db.close();
  }

  public saveArraySequential = (array: any[], storeName: string | IDBObjectStore, key: any): Promise<void> => {
    return new Promise<void>(
      (resolve, reject) => {
        const store = (typeof storeName !== 'string') ? storeName : this.getObjectStore(storeName, IDBMode.READWRITE);

        const wrapper = (acc: number) => {
          if (acc < array.length) {
            const value = (typeof key === 'string') ? array[acc]['' + key + ''] : array[acc][key];
            this.save(store, value, array[acc]).then(
              () => {
                wrapper(++acc);
              }
            ).catch((err) => {
              reject(err);
            });
          } else {
            resolve();
          }
        };
        wrapper(0);
      }
    );
  }

  public removeDatabase(database: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const req = this.indexedDB.deleteDatabase(database);

      req.onsuccess = () => {
        resolve();
      };
      req.onerror = () => {
        reject('Couldn\'t delete database');
      };
      req.onblocked = () => {
        reject('Couldn\'t delete database due to the operation being blocked');
      };
    });
  }

  public count(storeName: string | IDBObjectStore): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const store = (typeof storeName !== 'string') ? storeName : this.getObjectStore(storeName, IDBMode.READONLY);

      const countRequest = store.count();
      countRequest.onsuccess = () => {
        resolve(countRequest.result);
      };
      countRequest.onerror = reject;
    });
  }
}
