import {Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild} from '@angular/core';
import {isNullOrUndefined} from 'util';
import {SubscriptionManager} from '../../shared/subscription-manager';
import 'rxjs/add/observable/interval';

@Component({
  selector: 'app-popover',
  templateUrl: './popover.component.html',
  styleUrls: ['./popover.component.css']
})
export class PopoverComponent implements OnInit, OnChanges, OnDestroy {

  @ViewChild('svg') svg: ElementRef;
  @ViewChild('inner') inner: ElementRef;

  @Input() borderColor: string = '#3a70dd';
  @Input() pointer: 'left' | 'right' | 'bottom-left' = 'left';

  @Input() public width = 200;
  @Input() public height = 300;

  public margin: {
    left: number,
    top: number,
    right: number,
    bottom: number
  } = {
    left: 5,
    top: 5,
    right: 10,
    bottom: 20
  };


  private leftTopPolygon = {
    koord1: {
      x: 0,
      y: 0
    },
    koord2: {
      x: 20,
      y: this.margin.top
    },
    koord3: {
      x: this.margin.left,
      y: 20
    }
  };

  private leftBottomPolygon = {
    koord1: {
      x: 0,
      y: this.height + this.margin.top
    },
    koord2: {
      x: 20,
      y: this.height
    },
    koord3: {
      x: this.margin.left,
      y: this.height - 20
    }
  };

  private rightTopPolygon = {
    koord1: {
      x: this.width,
      y: 0
    },
    koord2: {
      x: this.width - 20,
      y: this.margin.top
    },
    koord3: {
      x: this.width - this.margin.right,
      y: 20
    }
  };

  public polygon = this.leftTopPolygon;
  private lineWidth = 2;
  private subscrmanager: SubscriptionManager = new SubscriptionManager();

  constructor() {
  }

  public getPolygonString(): string {
    const p = this.polygon;
    return `${p.koord1.x},${p.koord1.y} ${p.koord2.x},${p.koord2.y} ${p.koord3.x},${p.koord3.y} `;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.hasOwnProperty('borderColor') && !changes.borderColor.isFirstChange() && !isNullOrUndefined(changes.borderColor.currentValue)) {
    }

    if (changes.hasOwnProperty('pointer')) {
      if (changes.pointer.currentValue === 'left') {
        this.polygon = this.leftTopPolygon;
      } else if (changes.pointer.currentValue === 'bottom-left') {
        this.polygon = this.leftBottomPolygon;
      } else if (changes.pointer.currentValue === 'right') {
        this.polygon = this.rightTopPolygon;
      }
    }
  }

  ngOnInit() {
  }

  ngOnDestroy() {
    this.subscrmanager.destroy();
  }
}
