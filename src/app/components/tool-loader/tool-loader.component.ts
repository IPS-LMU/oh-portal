import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import {DomSanitizer, SafeUrl} from '@angular/platform-browser';
import {Operation} from '../../obj/tasks/operation';
import {isNullOrUndefined} from 'util';

@Component({
  selector: 'app-tool-loader',
  templateUrl: './tool-loader.component.html',
  styleUrls: ['./tool-loader.component.css']
})
export class ToolLoaderComponent implements OnInit, OnChanges {
  @ViewChild('iframe') iframe: ElementRef;

  public selectedtool: {
    url: SafeUrl
  } = {
    url: undefined
  };

  public set url(url: string) {
    if (!isNullOrUndefined(url) && url !== '') {
      this.selectedtool.url = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }
  }

  @Input() public operation: Operation = null;

  @Output() public datareceived: EventEmitter<any> = new EventEmitter<any>();

  constructor(private sanitizer: DomSanitizer) {
  }

  ngOnChanges(changes: SimpleChanges) {
  }

  ngOnInit() {
    this.onIframeLoaded();
  }

  onIframeLoaded() {
  }

  @HostListener('window:message', ['$event'])
  onMessage(e) {
    this.datareceived.emit(e);
  }
}
