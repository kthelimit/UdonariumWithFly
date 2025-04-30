import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';

import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { EventSystem, Network } from '@udonarium/core/system';
import { PeerContext } from '@udonarium/core/system/network/peer-context';
import { PeerSessionGrade } from '@udonarium/core/system/network/peer-session-state';
import { PeerCursor } from '@udonarium/peer-cursor';

import { FileSelecterComponent } from 'component/file-selecter/file-selecter.component';
import { LobbyComponent } from 'component/lobby/lobby.component';
import { AppConfig, AppConfigService } from 'service/app-config.service';
import { ModalService } from 'service/modal.service';
import { PanelService } from 'service/panel.service';
import { animate, style, transition, trigger } from '@angular/animations';
import { ChatMessageService } from 'service/chat-message.service';
import { ConfirmationComponent, ConfirmationType } from 'component/confirmation/confirmation.component';
import { GameCharacter } from '@udonarium/game-character';
import { ImageFile, ImageState } from '@udonarium/core/file-storage/image-file';
import { ImageStorage } from '@udonarium/core/file-storage/image-storage';

import * as localForage from 'localforage';

@Component({
  selector: 'peer-menu',
  templateUrl: './peer-menu.component.html',
  styleUrls: ['./peer-menu.component.css'],
  animations: [
    trigger('fadeInOut', [
      transition('false => true', [
        animate('50ms ease-in-out', style({ opacity: 1.0 })),
        animate('900ms ease-in-out', style({ opacity: 0 }))
      ])
    ])
  ]
})
export class PeerMenuComponent implements OnInit, OnDestroy {
  targetUserId: string = '';
  networkService = Network
  gameRoomService = ObjectStore.instance;

  isCopied = false;
  isRoomNameCopied = false;
  isPasswordCopied = false;
  isPasswordOpen = false;
  isRoomInfoCopied = false

  help: string = '';

  private _timeOutId: NodeJS.Timeout;
  private _timeOutId2: NodeJS.Timeout;
  private _timeOutId3: NodeJS.Timeout;
  private _timeOutId4: NodeJS.Timeout;

  private interval: NodeJS.Timeout;
  get myPeer(): PeerCursor { return PeerCursor.myCursor; }

  get myPeerName(): string {
    if (!PeerCursor.myCursor) return null;
    return PeerCursor.myCursor.name;
  }
  set myPeerName(name: string) {
    if (PeerCursor.myCursor) {
      PeerCursor.myCursor.name = name;
      if (PeerCursor.myCursor.name === PeerCursor.CHAT_DEFAULT_NAME) {
        localForage.removeItem(PeerCursor.CHAT_MY_NAME_LOCAL_STORAGE_KEY).catch(e => console.log(e));
      } else {
        localForage.setItem(PeerCursor.CHAT_MY_NAME_LOCAL_STORAGE_KEY, PeerCursor.myCursor.name).catch(e => console.log(e));
      }
    }
  }

  get myPeerColor(): string {
    if (!PeerCursor.myCursor) return PeerCursor.CHAT_DEFAULT_COLOR;
    return PeerCursor.myCursor.color;
  }
  set myPeerColor(color: string) {
    if (color && PeerCursor.myCursor) {
      color = color.trim().toLowerCase();
      if (!/^\#[0-9a-f]{6}$/.test(color)) return; 
      PeerCursor.myCursor.color = (color == PeerCursor.CHAT_TRANSPARENT_COLOR) ? PeerCursor.CHAT_DEFAULT_COLOR : color;
      if (PeerCursor.myCursor.color === PeerCursor.CHAT_DEFAULT_COLOR) {
        localForage.removeItem(PeerCursor.CHAT_MY_COLOR_LOCAL_STORAGE_KEY).catch(e => console.log(e));
      } else {
        localForage.setItem(PeerCursor.CHAT_MY_COLOR_LOCAL_STORAGE_KEY, PeerCursor.myCursor.color).catch(e => console.log(e));
      }
    }
  }

  get isGMMode(): boolean{ return PeerCursor.myCursor ? PeerCursor.myCursor.isGMMode : false; }
  set isGMMode(isGMMode: boolean) { if (PeerCursor.myCursor) PeerCursor.myCursor.isGMMode = isGMMode; }

  get isGMHold(): boolean { return PeerCursor.isGMHold; }
  get isDisableConnect(): boolean { return this.isGMHold || this.isGMMode; }

  get maskedPassword(): string { return '●●●●●●●●' }
  get config(): AppConfig { return AppConfigService.appConfig; }
  get canUsePrivateSession(): boolean { return this.config.backend.mode == 'skyway'; }

  constructor(
    private ngZone: NgZone,
    private modalService: ModalService,
    private panelService: PanelService,
    private chatMessageService: ChatMessageService,
    public appConfigService: AppConfigService
  ) { }

  ngOnInit() {
    Promise.resolve().then(() => { this.panelService.title = '접속 정보'; this.panelService.isAbleFullScreenButton = false });
  }

  ngAfterViewInit() {
    EventSystem.register(this)
      .on('OPEN_NETWORK', event => {
        this.ngZone.run(() => { });
      });
    this.interval = setInterval(() => { }, 1000);
  }

  ngOnDestroy() {
    clearTimeout(this._timeOutId);
    clearTimeout(this._timeOutId2);
    clearTimeout(this._timeOutId3);
    clearTimeout(this._timeOutId4);
    EventSystem.unregister(this);
    clearInterval(this.interval);
  }

  changeIcon() {
    let currentImageIdentifires: string[] = [];
    if (this.myPeer && this.myPeer.imageIdentifier) currentImageIdentifires = [this.myPeer.imageIdentifier];
    this.modalService.open<string>(FileSelecterComponent, { currentImageIdentifires: currentImageIdentifires }).then(value => {
      if (!this.myPeer || !value) return;
      this.myPeer.imageIdentifier = value;
      let file: ImageFile = ImageStorage.instance.get(value);
      if (file) {
        if (file.state === ImageState.COMPLETE) {
          localForage.setItem(PeerCursor.CHAT_MY_ICON_LOCAL_STORAGE_KEY, file.blob).catch(e => console.log(e));
        } else if (value === 'none_icon') {
          localForage.removeItem(PeerCursor.CHAT_MY_ICON_LOCAL_STORAGE_KEY).catch(e => console.log(e));
        } else {
          localForage.setItem(PeerCursor.CHAT_MY_ICON_LOCAL_STORAGE_KEY, value).catch(e => console.log(e));
        }
      }
    });
  }

  connectPeer() {
    let targetUserId = this.targetUserId;
    this.targetUserId = '';
    if (targetUserId.length < 1) return;
    this.help = '';
    let peer = PeerContext.create(targetUserId);
    if (peer.isRoom) return;
    ObjectStore.instance.clearDeleteHistory();
    Network.connect(peer);
    if (PeerCursor.isGMHold || this.isGMMode) {
      PeerCursor.isGMHold = false;
      this.isGMMode = false;
      if (this.isGMMode) {
        this.chatMessageService.sendOperationLog('GM모드를 해제');
        EventSystem.trigger('CHANGE_GM_MODE', null);
      }
    }
  }

  showLobby() {
    if (PeerCursor.isGMHold || this.isGMMode) {
      PeerCursor.isGMHold = false;
      this.isGMMode = false;
      if (this.isGMMode) {
        this.chatMessageService.sendOperationLog('GM모드를 해제');
        EventSystem.trigger('CHANGE_GM_MODE', null);
      }
    }
    this.modalService.open(LobbyComponent, { width: 700, height: 400, left: 0, top: 400 });
  }

  stringFromSessionGrade(grade: PeerSessionGrade): string {
    return PeerSessionGrade[grade] ?? PeerSessionGrade[PeerSessionGrade.UNSPECIFIED];
  }

  findUserId(peerId: string) {
    const peerCursor = PeerCursor.findByPeerId(peerId);
    return peerCursor ? peerCursor.userId : '';
  }

  findPeerName(peerId: string) {
    const peerCursor = PeerCursor.findByPeerId(peerId);
    return peerCursor ? peerCursor.name : '';
  }

  findPeerColor(peerId: string) {
    const peerCursor = PeerCursor.findByPeerId(peerId);
    return peerCursor ? peerCursor.color : '';
  }

  findPeerImageUrl(peerId: string) {
    const peerCursor = PeerCursor.findByPeerId(peerId);
    return peerCursor ? peerCursor.image.url : '';
  }

  findPeerIsGMMode(peerId: string): boolean {
    const peerCursor = PeerCursor.findByPeerId(peerId);
    return peerCursor ? peerCursor.isGMMode : false;
  }

  copyPeerId() {
    if (navigator.clipboard && this.canUsePrivateSession) {
      navigator.clipboard.writeText(this.networkService.peer.userId);
      this.isCopied = true;
      clearTimeout(this._timeOutId);
      this._timeOutId = setTimeout(() => {
        this.isCopied = false;
      }, 1000);
    }
  }

  copyRoomName() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(this.networkService.peer.roomName + '/' + this.networkService.peer.roomId);
      this.isRoomNameCopied = true;
      clearTimeout(this._timeOutId2);
      this._timeOutId2 = setTimeout(() => {
        this.isRoomNameCopied = false;
      }, 1000);
    }
  }

  copyPassword() {
    if (navigator.clipboard) {
      this.modalService.open(ConfirmationComponent, {
        title: '패스워드의 복사', 
        text: '패스워드를 클립보드에 복사합니까?',
        helpHtml: '패스워드를 공유할 때에는 SNS의 공개 어카운트 등으로 <b>불특정 다수에게 공개하는 것을 피해</b> 주세요.',
        type: ConfirmationType.OK_CANCEL,
        materialIcon: 'content_copy',
        action: () => {
          navigator.clipboard.writeText(this.networkService.peer.password);
          this.isPasswordCopied = true;
          clearTimeout(this._timeOutId3);
          this._timeOutId3 = setTimeout(() => {
            this.isPasswordCopied = false;
          }, 1000);
        }
      });
      this.isPasswordOpen = false;
    }
  }

  copyRoomInfo() {
    if (navigator.clipboard) {
      this.modalService.open(ConfirmationComponent, {
        title: '방 정보의 복사', 
        text: '방 정보(방 이름/방 ID, 패스워드)를 클립보드에 복사합니까?',
        helpHtml: '패스워드를 공유할 때에는 SNS의 공개 어카운트 등으로 <b>불특정 다수에게 공개하는 것을 피해</b> 주세요.',
        type: ConfirmationType.OK_CANCEL,
        materialIcon: 'content_copy',
        action: () => {
          navigator.clipboard.writeText('방 이름：' + this.networkService.peer.roomName + '/' + this.networkService.peer.roomId + '  패스워드：' + this.networkService.peer.password);
          this.isRoomInfoCopied = true;
          clearTimeout(this._timeOutId4);
          this._timeOutId4 = setTimeout(() => {
            this.isRoomInfoCopied = false;
          }, 1000);
        }
      });
      this.isPasswordOpen = false;
    }
  }

  isAbleClipboardCopy(): boolean {
    return navigator.clipboard ? true : false;
  }

  onPasswordOpen($event: Event) {
    if (this.isPasswordOpen) {
      this.isPasswordOpen = false;
    } else {
      $event.preventDefault();
      this.modalService.open(ConfirmationComponent, {
        title: '패스워드의 표시', 
        text: '패스워드를 표시합니까?',
        helpHtml: '플레이 실황중 등에 실수로 패스워드를 표시하지 않도록 주의해주세요. <br또한 패스워드를 공유할 때에는 SNS의 공개 어카운트 등으로 <b>불특정 다수에게 공개하는 것을 피해</b> 주세요.',
        type: ConfirmationType.OK_CANCEL,
        materialIcon: 'visibility',
        action: () => {
          this.isPasswordOpen = true;
          (<HTMLInputElement>$event.target).checked = true;
          //this.changeDetector.markForCheck();
        }
      });
    }
  }

  onGMMode($event: Event) {
    if (PeerCursor.isGMHold || this.isGMMode) {
      if (this.isGMMode) {
        $event.preventDefault();
        this.modalService.open(ConfirmationComponent, {
          title: 'GM모드 해제', 
          text: 'GM모드를 해제합니까?',
          type: ConfirmationType.OK_CANCEL,
          materialIcon: 'person_remove',
          action: () => {
            PeerCursor.isGMHold = false;
            this.isGMMode = false;
            (<HTMLInputElement>$event.target).checked = false;
            this.chatMessageService.sendOperationLog('GM모드를 해제');
            EventSystem.trigger('CHANGE_GM_MODE', null);
            //this.changeDetector.markForCheck();
            if (GameCharacter.isStealthMode) {
              this.modalService.open(ConfirmationComponent, {
                title: '스텔스 모드', 
                text: '스텔스 모드가 됩니다',
                help: '위치를 당신 혼자서만 보고 있는 캐릭터가 1개 이상 테이블 위에 있는 동안, 당신의 커서 위치는 다른 참가자에게 전달되지 않습니다.',
                type: ConfirmationType.OK,
                materialIcon: 'disabled_visible'
              });
            }
          }
        });
      } else {
        PeerCursor.isGMHold = false;
        this.isGMMode = false;
      }
    } else {
      $event.preventDefault();
      this.modalService.open(ConfirmationComponent, {
        title: 'GM모드가 된다', 
        text: 'GM모드가 되겠습니까？\nGM모드 중(보류 중 포함)에는 당신으로부터의 프라이빗 접속이나 방에 연결을 할 수 없습니다.',
        helpHtml: 'GM모드에서는<b>비밀 대화</b>, 뒷면의 <b>카드</b>, 공개되지 않은 <b>다이스심볼</b>, <b>캐릭터</b>위치, <b>커서</b>위치를 전부 보는 것이 가능하고 당신의 커서위치는 다른 참가자들에게 전달되지 않게 됩니다.\n\n<b><big>—With great power comes great responsibility.</big></b>',
        type: ConfirmationType.OK_CANCEL,
        materialIcon: 'person_add',
        action: () => {
          PeerCursor.isGMHold = true;
          this.isGMMode = false;
          (<HTMLInputElement>$event.target).checked = true;
          //this.changeDetector.markForCheck();
          this.modalService.open(ConfirmationComponent, {
            title: 'GM모드가 된다', 
            text: '아직 GM모드가 아닙니다.',
            helpHtml: 'GM모드가 되기 위해서는 채팅으로부터 <b>GM모드가 된다</b> 또는 <b>GM모드가 됩니다</b> 를 포함한 문장을 보내주세요.',
            type: ConfirmationType.OK,
            materialIcon: 'person_add'
          });
        }
      });
    }
  }

  healthIcon(helth) {
    if (helth >= 0.99) return 'sentiment_very_satisfied';
    if (helth > 0.97) return 'sentiment_dissatisfied';
    if (helth > 0.95) return 'mood_bad';
    return 'sentiment_very_dissatisfied';
  }

  healthClass(helth) {
    if (helth >= 0.99) return 'health-blue';
    if (helth > 0.97) return 'health-green';
    if (helth > 0.95) return 'health-yellow';
    return 'health-red';
  }
}
