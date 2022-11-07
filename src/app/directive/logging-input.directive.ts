import { AfterViewInit, Directive, ElementRef, Input, OnDestroy } from '@angular/core';
import { Card } from '@udonarium/card';
import { CardStack } from '@udonarium/card-stack';
import { ObjectNode } from '@udonarium/core/synchronize-object/object-node';
import { DataElement } from '@udonarium/data-element';
import { DiceSymbol } from '@udonarium/dice-symbol';
import { GameCharacter } from '@udonarium/game-character';
import { GameTableMask } from '@udonarium/game-table-mask';
import { Terrain } from '@udonarium/terrain';
import { TextNote } from '@udonarium/text-note';
import { ChatMessageService } from 'service/chat-message.service';

interface LoggingValue {
  timerId?: NodeJS.Timeout;
  oldValue: string;
  //isEditing: boolean;
};

@Directive({
  selector: '[appLogging]'
})
export class LoggingInputDirective implements AfterViewInit, OnDestroy {
  @Input('logging.disable') isDisable: boolean = false;
  @Input('logging.timeout') timeout: number = 666;
  @Input('logging.name') name: string;
  @Input('logging.dataElement') dataElement: DataElement;
  @Input('logging.loggingValue') showValue: boolean = true;

  private static LoggingValueMap = new Map<string, LoggingValue>(); 
  type = '오브젝트';

  ngAfterViewInit() {
    let elm = <ObjectNode>this.dataElement;
    while (elm = elm.parent) {
      if (elm instanceof Card) {
        this.type = '카드';
      }
      if (elm instanceof CardStack) {
        this.type = '카드 더미';
      }
      if (elm instanceof DiceSymbol) {
        this.type = (elm.isCoin ? '코인' : '다이스');
      }
      if (elm instanceof GameCharacter) {
        this.type = '캐릭터';
      }
      if (elm instanceof GameTableMask) {
        this.type = '맵마스크';
      }
      if (elm instanceof Terrain) {
        this.type = '지형';
      }
      if (elm instanceof TextNote) {
        this.type = '공유메모';
      }
      if (!elm.parentIsAssigned || elm.parentIsUnknown) break;
    }
    const LoggingValueMap = LoggingInputDirective.LoggingValueMap;
    const identifier = this.dataElement.identifier;
    const loggingNativeElement = this.elementRef.nativeElement;
    LoggingValueMap.set(identifier, { oldValue: this.loggingValue });
    // input 試してダメだったらイベントで制御考える
    /*
    LoggingValueMap.set(identifier, { oldValue: this.loggingValue, isEditing: false });
    const startFunc = () => { LoggingValueMap.get(identifier).isEditing = true; };
    const endFunc = () => { LoggingValueMap.get(identifier).isEditing = false; };
    ['focus', 'click', 'mousedown', 'pointerdown', 'touchstart', 'keydown'].forEach((eventName) => {
      loggingNativeElement.addEventListener(eventName, startFunc);
    });
    ['blur', 'mouseleave', 'pointerleave'].forEach((eventName) => {
      loggingNativeElement.addEventListener(eventName, endFunc);
    });
    */
    loggingNativeElement.addEventListener('input', () => { 
      //if (!LoggingValueMap.get(identifier).isEditing) return;
      if (LoggingValueMap.get(identifier).timerId) clearTimeout(LoggingValueMap.get(identifier).timerId);
      LoggingValueMap.get(identifier).timerId = setTimeout(() => {
        this.doLogging();
      }, this.timeout);
    });
    /*
    loggingNativeElement.addEventListener('change', () => {
      if (!LoggingValueMap.get(identifier).isEditing) return;
      if (LoggingValueMap.get(identifier).timerId) clearTimeout(LoggingValueMap.get(identifier).timerId);
      LoggingValueMap.get(identifier).timerId = setTimeout(() => {
        this.doLogging();
      }, this.timeout);
    });
    */
  }

  ngOnDestroy() {
    const LoggingValueMap = LoggingInputDirective.LoggingValueMap;
    const identifier = this.dataElement.identifier;
    if (LoggingValueMap.get(identifier) && LoggingValueMap.get(identifier).timerId) {
      this.doLogging();
    }
  }

  doLogging() {
    const LoggingValueMap = LoggingInputDirective.LoggingValueMap;
    const identifier = this.dataElement.identifier;
    //LoggingValueMap.get(identifier).isEditing = false;
    if (LoggingValueMap.get(identifier).timerId) {
      clearTimeout(LoggingValueMap.get(identifier).timerId);
      LoggingValueMap.get(identifier).timerId = null;
    }
    const oldValue = LoggingValueMap.get(identifier).oldValue;
    const value = this.loggingValue;
    const dataElement = this.dataElement;
    if (!this.isDisable && value != oldValue) {
      let text = `${this.name == '' ? `(이름없는 ${this.type})` : this.name} 의 ${dataElement.name == '' ? '(이름없는 변수)' : dataElement.name} 을/를 변경`;
      if (this.showValue && (dataElement.isSimpleNumber || dataElement.isNumberResource || dataElement.isAbilityScore)) {
        text += ` ${oldValue} → ${value}`;
      } else if (dataElement.isCheckProperty) {
        text += ` ${value}`
      }
      this.chatMessageService.sendOperationLog(text);
    }
    LoggingValueMap.get(identifier).oldValue = value;
  }

  get loggingValue(): string {
    const dataElement = this.dataElement;
    if (!dataElement) return;
    let ret: string;
    if (dataElement.isSimpleNumber) {
      ret = `${dataElement.value}`;
    } else if (dataElement.isNumberResource) {
      ret = `${dataElement.currentValue}/${dataElement.value && dataElement.value != 0 ? dataElement.value : '???'}`;
    } else if (dataElement.isCheckProperty) {
      ret = `${dataElement.value ? ' → ✔ON' : ' → OFF'}`;
    } else if (dataElement.isAbilityScore) {
      const modifire = dataElement.calcAbilityScore();
      ret = `${dataElement.value}`;
      if (dataElement.currentValue) ret += `(${modifire >= 0 ? '+' : ''}${modifire})`;
    } else {
      ret = dataElement.value ? dataElement.value.toString() : '';
    }
    return ret;
  }

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private chatMessageService: ChatMessageService
  ) { }

}
