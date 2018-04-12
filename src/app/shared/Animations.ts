import {animate, state, style, transition, trigger} from '@angular/animations';

export const ANIMATIONS = [
  trigger('fadeToggle', [
    state('closed', style({
      display: 'none',
      opacity: '0.0'
    })),
    state('opened', style({
      display: 'inherit',
      opacity: '1.0'
    })),
    state('*', style({
      display: 'none',
      opacity: '0.0'
    })),
    transition('* => opened', animate('300ms ease-in')),
    transition('opened => closed', animate('300ms ease-in'))
  ]),

  trigger('expandToggle', [
    state('closed', style({
      height: '40px'
    })),
    state('opened', style({
      height: '200px'
    })),
    state('*', style({
      height: '40px'
    })),
    transition('* => opened', animate('300ms ease-in')),
    transition('opened => closed', animate('300ms ease-in'))
  ]),

  trigger('blop', [
    state('blopped', style({
      height   : '40px',
      width    : '40px',
      transform: 'translate(-5px, -10px)'
    })),
    state('*', style({
      transform: 'translateX(0)'
    })),
    transition('* => blopped', animate('300ms ease-in')),
    transition('blopped => *', animate('300ms ease-in'))
  ]),

  trigger('expandLeft', [
    state('opened', style({
      width: '100%'
    })),
    state('closed', style({
      width: '30%'
    })),
    state('*', style({
      width: '100%'
    })),
    transition('* => closed', animate('600ms ease-in')),
    transition('opened => closed', animate('600ms ease-in')),
    transition('closed => opened', animate('600ms ease-out'))
  ]),

  trigger('comeIn', [
    state('closed', style({
      'margin-left': '30%',
      'width': '70%'
    })),
    state('opened', style({
      'margin-left': '100%',
      'width': '70%'
    })),
    state('*', style({
      'margin-left': '100%',
      'width': '70%'
    })),
    transition('* => closed', animate('600ms ease-in')),
    transition('opened => closed', animate('600ms ease-in')),
    transition('closed => opened', animate('600ms ease-out'))
  ]),
];
