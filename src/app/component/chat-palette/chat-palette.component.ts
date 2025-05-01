import { Component, ElementRef, Input, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ChatPalette } from '@udonarium/chat-palette';
import { ChatTab } from '@udonarium/chat-tab';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { EventSystem } from '@udonarium/core/system';
import { StringUtil } from '@udonarium/core/system/util/string-util';
import { DiceBot } from '@udonarium/dice-bot';
import { GameCharacter } from '@udonarium/game-character';
import { PeerCursor } from '@udonarium/peer-cursor';
import { ChatInputComponent } from 'component/chat-input/chat-input.component';
import { TextViewComponent } from 'component/text-view/text-view.component';
import { ChatMessageService } from 'service/chat-message.service';
import { PanelOption, PanelService } from 'service/panel.service';
import { PointerDeviceService } from 'service/pointer-device.service';

@Component({
  selector: 'chat-palette',
  templateUrl: './chat-palette.component.html',
  styleUrls: ['./chat-palette.component.css']
})
export class ChatPaletteComponent implements OnInit, OnDestroy {
  @ViewChild('chatInput', { static: true }) chatInputComponent: ChatInputComponent;
  @ViewChild('chatPlette') chatPletteElementRef: ElementRef<HTMLSelectElement>;
  @Input() character: GameCharacter = null;

  get palette(): ChatPalette { return this.character.chatPalette; }
  
  paletteCache: string[] = [];
  paletteRenewInterval: boolean = true;
  paletteRenewIntervalId = setInterval(() => {
    this.paletteRenewInterval = true;
  }, 200);
  get filteredPaletteStrings(): string[] {
    this.ngZone.run(() => {
      if (this.paletteRenewInterval) {
        this.paletteRenewInterval = false;
        this.paletteCache = this.character.chatPalette.getPalette().filter(text => this.filter(text));
      }
    });
    return this.paletteCache;
  }

  get color(): string {
    return this.chatInputComponent.color;
  }

  private _gameType: string = '';
  get gameType(): string { return !this._gameType ? 'DiceBot' : this._gameType; };
  set gameType(gameType: string) {
    this._gameType = gameType;
    if (this.character.chatPalette) this.character.chatPalette.dicebot = gameType;
  };

  get sendFrom(): string { return this.character.identifier; }
  set sendFrom(sendFrom: string) {
    this.onSelectedCharacter(sendFrom);
  }

  chatTabidentifier: string = '';
  text: string = '';
  sendTo: string = '';

  isEdit: boolean = false;
  editPalette: string = '';

  filterText: string = '';

  private doubleClickTimer: NodeJS.Timer = null;

  private selectedPaletteIndex = -1;

  get diceBotInfos() { return DiceBot.diceBotInfos }

  get chatTab(): ChatTab { return ObjectStore.instance.get<ChatTab>(this.chatTabidentifier); }
  get myPeer(): PeerCursor { return PeerCursor.myCursor; }
  get otherPeers(): PeerCursor[] { return ObjectStore.instance.getObjects(PeerCursor); }

  constructor(
    public chatMessageService: ChatMessageService,
    private panelService: PanelService,
    private pointerDeviceService: PointerDeviceService,
    private ngZone: NgZone
  ) { }

  ngOnInit() {
    Promise.resolve().then(() => this.updatePanelTitle());
    this.chatTabidentifier = this.chatMessageService.chatTabs ? this.chatMessageService.chatTabs[0].identifier : '';
    this.gameType = this.character.chatPalette ? this.character.chatPalette.dicebot : '';
    EventSystem.register(this)
      .on('DELETE_GAME_OBJECT', event => {
        if (this.character && this.character.identifier === event.data.identifier) {
          this.panelService.close();
        }
        if (this.chatTabidentifier === event.data.identifier) {
          this.chatTabidentifier = this.chatMessageService.chatTabs ? this.chatMessageService.chatTabs[0].identifier : '';
        }
      });
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
    clearInterval(this.paletteRenewIntervalId);
    if (this.isEdit) this.toggleEditMode();
  }

  updatePanelTitle() {
    this.panelService.title = this.character.name + ' 의 채팅 팔레트';
  }

  onSelectedCharacter(identifier: string) {
    if (this.isEdit) this.toggleEditMode();
    let object = ObjectStore.instance.get(identifier);
    if (object instanceof GameCharacter) {
      this.character = object;
      let gameType = this.character.chatPalette ? this.character.chatPalette.dicebot : '';
      if (0 < gameType.length) this.gameType = gameType;
    }
    this.updatePanelTitle();
  }

  clickPalette(line: string) {
    if (!this.chatPletteElementRef.nativeElement) return;
    const evaluatedLine = this.palette.evaluate(line, this.character.rootDataElement);
    if (this.doubleClickTimer && this.selectedPaletteIndex === this.chatPletteElementRef.nativeElement.selectedIndex) {
      clearTimeout(this.doubleClickTimer);
      this.doubleClickTimer = null;
      this.chatInputComponent.sendChat(null);
    } else {
      this.selectedPaletteIndex = this.chatPletteElementRef.nativeElement.selectedIndex;
      this.text = evaluatedLine;
      let textArea: HTMLTextAreaElement = this.chatInputComponent.textAreaElementRef.nativeElement;
      textArea.value = this.text;
      this.doubleClickTimer = setTimeout(() => { this.doubleClickTimer = null }, 400);
    }
  }

  moveToInput(e: Event) {
    if (!this.chatPletteElementRef.nativeElement) return;
    const selectedPaletteIndex = this.chatPletteElementRef.nativeElement.selectedIndex;
    if (selectedPaletteIndex <= 0) {
      this.text = this._tempText;
      this.chatInputComponent.textAreaElementRef.nativeElement.value = this._tempText;
      this.chatInputComponent.textAreaElementRef.nativeElement.focus();
      e.preventDefault();
    }
  }

  arrowPalette() {
    if (!this.chatPletteElementRef.nativeElement) return;
    this.selectedPaletteIndex = this.chatPletteElementRef.nativeElement.selectedIndex;
    if (this.selectedPaletteIndex >= 0 && this.chatPletteElementRef.nativeElement.options[this.selectedPaletteIndex]) {
      this.ngZone.run(() => {
        this.text = this.palette.evaluate(this.chatPletteElementRef.nativeElement.options[this.selectedPaletteIndex].value, this.character.rootDataElement);
        let textArea: HTMLTextAreaElement = this.chatInputComponent.textAreaElementRef.nativeElement;
        textArea.value = this.text;
      });
    }
  }

  enterPalette(line: string, e: Event=null) {
    if (!this.chatPletteElementRef.nativeElement) return;
    this.text = this.palette.evaluate(line, this.character.rootDataElement);
    //this.chatInputComponent.sendChat(null);
    this.chatInputComponent.focusInput();
    //this.chatPletteElementRef.nativeElement.selectedIndex = -1;
    //this.filterText = '';
    if (e) e.preventDefault();
  }

  private _tempText: string;
  moveToPalette(tempText: string) {
    this._tempText = tempText;
    if (!this.chatPletteElementRef.nativeElement) return;
    if (this.chatPletteElementRef.nativeElement.options.length <= 0) return;
    if (this.chatPletteElementRef.nativeElement.selectedIndex <= 0) this.chatPletteElementRef.nativeElement.options[0].selected = true;
    this.chatPletteElementRef.nativeElement.focus();
  }

  sendChat(value: { text: string, gameType: string, sendFrom: string, sendTo: string,
    color?: string, isInverse?:boolean, isHollow?: boolean, isBlackPaint?: boolean, aura?: number, isUseFaceIcon?: boolean, characterIdentifier?: string, standIdentifier?: string, standName?: string, isUseStandImage?: boolean }) {
    if (this.chatTab) {
      let text = this.palette.evaluate(value.text, this.character.rootDataElement);
      this.chatMessageService.sendMessage(
        this.chatTab, 
        text, 
        value.gameType, 
        value.sendFrom, 
        value.sendTo,
        value.color, 
        value.isInverse,
        value.isHollow,
        value.isBlackPaint,
        value.aura,
        value.isUseFaceIcon,
        value.characterIdentifier,
        value.standIdentifier,
        value.standName,
        value.isUseStandImage
      );
      this.filterText = '';
    }
  }

  resetPletteSelect() {
    if (!this.chatPletteElementRef.nativeElement) return;
    this.chatPletteElementRef.nativeElement.selectedIndex = -1;
  }

  toggleEditMode() {
    this.isEdit = this.isEdit ? false : true;
    if (this.isEdit) {
      this.editPalette = this.palette.value + '';
    } else {
      this.palette.setPalette(this.editPalette);
    }
  }

  filter(value: string): boolean {
    if (this.filterText == null || this.filterText.trim() == '') return true;
    const nomarizeFilterText = StringUtil.toHalfWidth(this.filterText.replace(/[―ー—‐]/g, '-').replace(/[\u3041-\u3096]/g, m => String.fromCharCode(m.charCodeAt(0) + 0x60))).replace(/[\r\n\s]+/, ' ').toUpperCase().trim();
    const nomarizeValue = StringUtil.toHalfWidth(value.replace(/[―ー—‐]/g, '-').replace(/[\u3041-\u3096]/g, m => String.fromCharCode(m.charCodeAt(0) + 0x60))).replace(/[\r\n\s]+/, ' ').toUpperCase().trim();
    if (nomarizeValue.indexOf(nomarizeFilterText) >= 0) return true;
    const nomarizeEvaluateValue = StringUtil.toHalfWidth(!/[{｛]/.test(value) ? value : this.palette.evaluate(value, this.character.rootDataElement).replace(/[―ー—‐]/g, '-').replace(/[\u3041-\u3096]/g, m => String.fromCharCode(m.charCodeAt(0) + 0x60))).replace(/[\r\n\s]+/, ' ').toUpperCase().trim();
    return nomarizeEvaluateValue.indexOf(nomarizeFilterText) >= 0;
  }

  helpChatPallet() {
    let coordinate = this.pointerDeviceService.pointers[0];
    let option: PanelOption = { left: coordinate.x, top: coordinate.y, width: 560, height: 620 };
    let textView = this.panelService.open(TextViewComponent, option);
    textView.title = '채팅 표기법과 채팅 팔레트의 사용 방법';
    textView.shadowing = '💭';
    textView.text = [
`　파라미터 조작 명령어, 다이스봇 명령어는 전각과 반각을 구별하지 않습니다. 또한 다이스봇 명령어나 파라미터의 이름은 알파벳의 대문자와 소문자를 구별하지 않습니다. 아래를 병용하는 경우, 스페이스로 구분해 파라미터 조작 커맨드, 다이스봇 커맨드, 채팅 메세지의 순서로 기술합니다, 각각 생략이 가능합니다.

　채팅 내용을 채팅 팔레트에 준비할 수 있습니다. 각 행에 하나의 내용을 기술하고 행을 싱글클릭으로 채팅창으로 호출하여 더블클릭으로 전송합니다.

·파라미터 조작 명령어
　캐릭터를 통한 채팅 송신 시, 선두에 :, 파라미터 이름, 조작(증가 + , 감소 - , 대입 = ), 조작 내용의 순서로 기술하고, 채팅으로부터 캐릭터의 파라미터 조작을 실시할 수 있습니다. 조작 내용에 다이스봇 커맨드를 기재하는 것으로 다이스롤 결과로 조작을 실시할 수 있습니다(리소스나 수치, 능력치를 조작하는 경우, 마지막에 하나의 숫자를 반환할 필요가 있습니다).
　또, 조작으로서 >를 사용하면 다이스봇 커맨드를 (다이스롤을 실시하지 않고) 직접 파라미터에 대입할 수 있습니다. (현 상태 name, size, height, altitude는 조작할 수 없습니다). 게다가 :로 구분하여 여러 작업을 기술할 수 있습니다, 파라미터 조작 명령은 채팅에 표시되지 않습니다.

파라미터 조작 명령의 예)
　: HP+2d6:MP-4	HP를 2d6 회복하고 MP를 4점 소비합니다.
　: 침식률+1D10	등장!

리소스의 조작은 최대치가 적용됩니다, 명령어에 의한 조작에서는 최대치를 넘지 않고, 이미 최대치를 넘고 있으면 그 이상 증가하지 않습니다.

　체크 박스는 조작이 + 의 경우는 조작 내용에 관계없이 온, - 의 경우는 오프가 됩니다. 또한, 공백문자, 0, off, ☐(빈 체크박스)를 대입(= 또는 >)한 경우 오프, 그 외의 대입은 온이 됩니다. 또한 성공/실패를 반환하는 다이스 롤 결과를 대입(=)할 경우 성공은 켜지고 실패는 꺼집니다.

·다이스봇 명령어
　채팅에서 다이스봇 명령을 전송함으로써 다이스롤이나 표를 참조할 수 있습니다. 실제 명령어는 게임 시스템별 다이스봇 도움말을 참조하십시오. 또한 다이스봇표 기능을 통해 다이스봇 명령어를 확장할 수 있습니다.

·파라미터 참조
　{와 }로 둘러싸서 파라미터 이름을 기재하면 채팅 팔레트에서 선택했을 때와 채팅을 송신했을 때 파라미터의 내용으로 대체됩니다. 또한 파라미터 이름의 맨 앞에 $를 붙이는 것으로, 전술한 파라미터 조작 커맨드를 적용 후의 값을 참조합니다.
　또한 $수치를 참조하는 것에 의해 파라미터 조작에 의한 실제 변화량(자원, 수치, 능력치만 다이스롤 결과나 최대치에 의한 절사를 고려)을 참조합니다. 수치는 1부터 개시에서 1로 파라미터 조작 커맨드의 최초의 조작 결과, 2에서 2번째의 결과…가 됩니다.

파라미터 참조의 예)
　: HP-2d62d6+{근력}+2HP{$1}, 근력에 +2하여 판정(현재 HP{$HP})

·추가값
　채팅 팔레트의 행에 //이름=값의 형태로 기술하는 것으로, 파라미터와 같이 채팅 메시지로부터 참조할 수 있는 값을 설정할 수 있습니다(커맨드로 조작은 할 수 없습니다).

추가 값의 예)
　//날씨=비

채팅 팔레트의 어느 한 줄에 위의 예와 같이 기술되어 있으면, 그 캐릭터에서 송신하는 명령어나 채팅 메세지 중의 {날씨} 가 비로 대체됩니다.

·줄 바꿈, 공백
　채팅 메시지 중에 \\n 라고 기술한 경우 거기서 줄 바꿈됩니다(n은 소문자,\\n표시되지 않습니다), 채팅 팔레트는 1행에 하나의 송신 내용을 기술해, 줄 바꿈을 직접 기술할 수 없으므로, 이것을 이용해 줄 바꿈합니다.
　\\s(s가 반각)으로 기술한 경우 반각스페이스, \\s(s가 전각)로 기술한 경우 전각스페이스가 됩니다(전각 반각을 구별하는 예외입니다), 명령어 중에 스페이스는 기술할 수 없기 때문에 필요하면 이쪽을 이용합니다. 예외로서 다이스봇 명령 CHOICE의 스페이스 구분에서의 기술에서는 스페이스를 기술할 수 있지만, 그 경우 채팅 메시지를 기술할 수 없습니다(스페이스 구분의 마지막도 CHOICE 명령의 일부로 간주됩니다).

·루비(후리가나)
　채팅 내용의 루비를 붙이고 싶은 부분의 시작에 ｜(파이프), 종료에 《 와》로 둘러서 후리가나의 내용을 기술합니다.

루비의 예)
　받아라!｜약속된 승리의 검《엑스칼리버》!

・💭
　캐릭터에서 채팅을 보낼 때, 「와 」로 둘러싼 내용을 💭로 표시합니다.`];
  }
}
