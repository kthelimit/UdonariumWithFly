import { AfterViewInit, Component, NgZone, OnDestroy, OnInit, ViewChild, ViewContainerRef } from '@angular/core';

import { ChatTabList } from '@udonarium/chat-tab-list';
import { AudioPlayer, VolumeType } from '@udonarium/core/file-storage/audio-player';
import { AudioSharingSystem } from '@udonarium/core/file-storage/audio-sharing-system';
import { AudioStorage } from '@udonarium/core/file-storage/audio-storage';
import { FileArchiver } from '@udonarium/core/file-storage/file-archiver';
import { ImageFile } from '@udonarium/core/file-storage/image-file';
import { ImageSharingSystem } from '@udonarium/core/file-storage/image-sharing-system';
import { ImageStorage } from '@udonarium/core/file-storage/image-storage';
import { ObjectFactory } from '@udonarium/core/synchronize-object/object-factory';
import { ObjectSerializer } from '@udonarium/core/synchronize-object/object-serializer';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { ObjectSynchronizer } from '@udonarium/core/synchronize-object/object-synchronizer';
import { EventSystem, Network } from '@udonarium/core/system';
import { DataSummarySetting } from '@udonarium/data-summary-setting';
import { DiceBot } from '@udonarium/dice-bot';
import { Jukebox } from '@udonarium/Jukebox';
import { PeerCursor } from '@udonarium/peer-cursor';
import { PresetSound, SoundEffect } from '@udonarium/sound-effect';
import { TableSelecter } from '@udonarium/table-selecter';

import { ChatWindowComponent } from 'component/chat-window/chat-window.component';
import { ContextMenuComponent } from 'component/context-menu/context-menu.component';
import { FileStorageComponent } from 'component/file-storage/file-storage.component';
import { GameCharacterSheetComponent } from 'component/game-character-sheet/game-character-sheet.component';
import { GameObjectInventoryComponent } from 'component/game-object-inventory/game-object-inventory.component';
import { GameTableSettingComponent } from 'component/game-table-setting/game-table-setting.component';
import { JukeboxComponent } from 'component/jukebox/jukebox.component';
import { ModalComponent } from 'component/modal/modal.component';
import { PeerMenuComponent } from 'component/peer-menu/peer-menu.component';
import { TextViewComponent } from 'component/text-view/text-view.component';
import { UIPanelComponent } from 'component/ui-panel/ui-panel.component';
import { AppConfig, AppConfigService } from 'service/app-config.service';
import { ChatMessageService } from 'service/chat-message.service';
import { ContextMenuSeparator, ContextMenuService } from 'service/context-menu.service';
import { ModalService } from 'service/modal.service';
import { PanelOption, PanelService } from 'service/panel.service';
import { PointerDeviceService } from 'service/pointer-device.service';
import { SaveDataService } from 'service/save-data.service';
import { StandImageService } from 'service/stand-image.service';
import { GameCharacter } from '@udonarium/game-character';
import { DataElement } from '@udonarium/data-element';
import { StandImageComponent } from 'component/stand-image/stand-image.component';
import { DiceRollTable } from '@udonarium/dice-roll-table';
import { DiceRollTableList } from '@udonarium/dice-roll-table-list';
import { DiceRollTableSettingComponent } from 'component/dice-roll-table-setting/dice-roll-table-setting.component';
import { CutInSettingComponent } from 'component/cut-in-setting/cut-in-setting.component';

import { ImageTag } from '@udonarium/image-tag';
import { CutInService } from 'service/cut-in.service';
import { CutIn } from '@udonarium/cut-in';
import { CutInList } from '@udonarium/cut-in-list';
import { ConfirmationComponent, ConfirmationType } from 'component/confirmation/confirmation.component';
import { SwUpdate } from '@angular/service-worker';

import * as localForage from 'localforage';
import { animate, keyframes, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  animations: [
    trigger('fadeInOut', [
      transition('void => *', [
        animate('100ms ease-out', keyframes([
          style({ opacity: 0, offset: 0 }),
          style({ opacity: 1, offset: 1.0 })
        ]))
      ]),
      transition('* => void', [
        animate('100ms ease-in', keyframes([
          style({ opacity: 1, offset: 0 }),
          style({ opacity: 0, offset: 1.0 })
        ]))
      ])
    ])
  ]
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('modalLayer', { read: ViewContainerRef, static: true }) modalLayerViewContainerRef: ViewContainerRef;
  private immediateUpdateTimer: NodeJS.Timeout = null;
  private lazyUpdateTimer: NodeJS.Timeout = null;
  private openPanelCount: number = 0;
  isSaveing: boolean = false;
  progresPercent: number = 0;

  isHorizontal = false;
  isLoggedin = false;
  isUpdateCanceled = false;

  static imageUrl = '';
  get imageUrl(): string {
    return AppComponent.imageUrl;
  }
  
  private noticeIntervalTimer: NodeJS.Timer = null;

  get otherPeers(): PeerCursor[] { return ObjectStore.instance.getObjects(PeerCursor); }

  private static _noticePlayer: AudioPlayer;
  static get noticePlayer(): AudioPlayer {
    if (!AppComponent._noticePlayer) {
      AppComponent._noticePlayer = new AudioPlayer();
      AppComponent._noticePlayer.volumeType = VolumeType.NOTICE;
    }
    return AppComponent._noticePlayer;
  }
 
  notice(audioIdentifier=PresetSound.puyon) {
    const audio = AudioStorage.instance.get(audioIdentifier);
    if (audio && audio.isReady) {
      EventSystem.unregister(this, 'UPDATE_AUDIO_RESOURE');
      AppComponent.noticePlayer.play(audio);
    } else {
      EventSystem.register(this)
      .on('UPDATE_AUDIO_RESOURE', -100, event => {
        this.notice(audioIdentifier);
      });
    }
  }

  constructor(
    private swUpdate: SwUpdate,
    private modalService: ModalService,
    private panelService: PanelService,
    private pointerDeviceService: PointerDeviceService,
    private chatMessageService: ChatMessageService,
    private appConfigService: AppConfigService,
    private saveDataService: SaveDataService,
    private ngZone: NgZone,
    private contextMenuService: ContextMenuService,
    private standImageService: StandImageService,
    private cutInService: CutInService
  ) {

    this.ngZone.runOutsideAngular(() => {
      EventSystem;
      Network;
      FileArchiver.instance.initialize();
      ImageSharingSystem.instance.initialize();
      ImageStorage.instance;
      AudioSharingSystem.instance.initialize();
      AudioStorage.instance;
      ObjectFactory.instance;
      ObjectSerializer.instance;
      ObjectStore.instance;
      ObjectSynchronizer.instance.initialize();
    });
    this.appConfigService.initialize();
    this.pointerDeviceService.initialize();

    TableSelecter.instance.initialize();
    ChatTabList.instance.initialize();
    DataSummarySetting.instance.initialize();

    let diceBot: DiceBot = new DiceBot('DiceBot', this.chatMessageService);
    diceBot.initialize();
    DiceBot.getHelpMessage('').then(() => this.lazyNgZoneUpdate(true));

    let jukebox: Jukebox = new Jukebox('Jukebox');
    jukebox.initialize();

    let soundEffect: SoundEffect = new SoundEffect('SoundEffect');
    soundEffect.initialize();

    ChatTabList.instance.addChatTab('메인 탭', 'MainTab');
    let subTab = ChatTabList.instance.addChatTab('서브 탭', 'SubTab');
    subTab.recieveOperationLogLevel = 1;

    CutInList.instance.initialize();

    let sampleDiceRollTable = new DiceRollTable('SampleDiceRollTable');
    sampleDiceRollTable.initialize();
    sampleDiceRollTable.name = '샘플 다이스봇 표'
    sampleDiceRollTable.command = 'SAMPLE'
    sampleDiceRollTable.dice = '1d6';
    sampleDiceRollTable.value = "1:이것은 다이스봇 표의 샘플입니다.\n2:숫자와 대응하는 결과를 1줄에 1개씩 :(콜론)으로 구분하고\n3:숫자:결과의 형태로 작성합니다.\n4:\\\\n  \\n으로 행을 바꿉니다.\n5-6:또, -(하이픈)으로 구분해서 숫자의 범위를 지정할 수 있습니다.";
    DiceRollTableList.instance.addDiceRollTable(sampleDiceRollTable);

    let fileContext = ImageFile.createEmpty('none_icon').toContext();
    fileContext.url = './assets/images/ic_account_circle_black_24dp_2x.png';
    let noneIconImage = ImageStorage.instance.add(fileContext);
    ImageTag.create(noneIconImage.identifier).tag = '*default 아이콘';
    ImageTag.create(noneIconImage.identifier).tag = '*기본 아이콘';

    fileContext = ImageFile.createEmpty('stand_no_image').toContext();
    fileContext.url = './assets/images/nc96424.png';
    let standNoIconImage = ImageStorage.instance.add(fileContext);
    ImageTag.create(standNoIconImage.identifier).tag = '*기본 스탠드';

    try {
      });
      localForage.getItem(AudioPlayer.AUDITION_VOLUME_LOCAL_STORAGE_KEY).then(volume => {
        if (typeof volume === 'number' && 0 <= volume && volume <= 1) AudioPlayer.auditionVolume = volume;
      });
      });
      localForage.getItem(AudioPlayer.NOTICE_VOLUME_LOCAL_STORAGE_KEY).then(volume => {
        if (typeof volume === 'number' && 0 <= volume && volume <= 1) AudioPlayer.noticeVolume = volume;
      });
      localForage.getItem(AudioPlayer.MAIN_IS_MUTE_LOCAL_STORAGE_KEY).then(isMute => AudioPlayer.isMute = !!isMute);
      localForage.getItem(AudioPlayer.AUDITION_IS_MUTE_LOCAL_STORAGE_KEY).then(isMute => AudioPlayer.isAuditionMute = !!isMute);
      localForage.getItem(AudioPlayer.SOUND_EFFECT_IS_MUTE_LOCAL_STORAGE_KEY).then(isMute => AudioPlayer.isSoundEffectMute = !!isMute);
      localForage.getItem(AudioPlayer.NOTICE_IS_MUTE_LOCAL_STORAGE_KEY).then(isMute => AudioPlayer.isNoticeMute = !!isMute);
    } catch(e) {
      console.log(e);
    }

    AudioPlayer.resumeAudioContext();
    PresetSound.dicePick = AudioStorage.instance.add('./assets/sounds/soundeffect-lab/shoulder-touch1.mp3').identifier;
    PresetSound.dicePut = AudioStorage.instance.add('./assets/sounds/soundeffect-lab/book-stack1.mp3').identifier;
    PresetSound.diceRoll1 = AudioStorage.instance.add('./assets/sounds/on-jin/spo_ge_saikoro_teburu01.mp3').identifier;
    PresetSound.diceRoll2 = AudioStorage.instance.add('./assets/sounds/on-jin/spo_ge_saikoro_teburu02.mp3').identifier;
    PresetSound.cardDraw = AudioStorage.instance.add('./assets/sounds/soundeffect-lab/card-turn-over1.mp3').identifier;
    PresetSound.cardPick = AudioStorage.instance.add('./assets/sounds/soundeffect-lab/shoulder-touch1.mp3').identifier;
    PresetSound.cardPut = AudioStorage.instance.add('./assets/sounds/soundeffect-lab/book-stack1.mp3').identifier;
    PresetSound.cardShuffle = AudioStorage.instance.add('./assets/sounds/soundeffect-lab/card-open1.mp3').identifier;
    PresetSound.piecePick = AudioStorage.instance.add('./assets/sounds/soundeffect-lab/shoulder-touch1.mp3').identifier;
    PresetSound.piecePut = AudioStorage.instance.add('./assets/sounds/soundeffect-lab/book-stack1.mp3').identifier;
    PresetSound.blockPick = AudioStorage.instance.add('./assets/sounds/tm2/tm2_pon002.wav').identifier;
    PresetSound.blockPut = AudioStorage.instance.add('./assets/sounds/tm2/tm2_pon002.wav').identifier;
    PresetSound.lock = AudioStorage.instance.add('./assets/sounds/tm2/tm2_switch001.wav').identifier;
    PresetSound.unlock = AudioStorage.instance.add('./assets/sounds/tm2/tm2_switch001.wav').identifier;
    PresetSound.sweep = AudioStorage.instance.add('./assets/sounds/tm2/tm2_swing003.wav').identifier;
    PresetSound.puyon = AudioStorage.instance.add('./assets/sounds/soundeffect-lab/puyon1.mp3').identifier;
    PresetSound.surprise = AudioStorage.instance.add('./assets/sounds/otologic/Onmtp-Surprise02-1.mp3').identifier;
    PresetSound.coinToss = AudioStorage.instance.add('./assets/sounds/niconicomons/nc146227.mp3').identifier;
    PresetSound.selectionStart = AudioStorage.instance.add('./assets/sounds/soundeffect-lab/decision50.mp3').identifier;

    AudioStorage.instance.get(PresetSound.dicePick).isHidden = true;
    AudioStorage.instance.get(PresetSound.dicePut).isHidden = true;
    AudioStorage.instance.get(PresetSound.diceRoll1).isHidden = true;
    AudioStorage.instance.get(PresetSound.diceRoll2).isHidden = true;
    AudioStorage.instance.get(PresetSound.cardDraw).isHidden = true;
    AudioStorage.instance.get(PresetSound.cardPick).isHidden = true;
    AudioStorage.instance.get(PresetSound.cardPut).isHidden = true;
    AudioStorage.instance.get(PresetSound.cardShuffle).isHidden = true;
    AudioStorage.instance.get(PresetSound.piecePick).isHidden = true;
    AudioStorage.instance.get(PresetSound.piecePut).isHidden = true;
    AudioStorage.instance.get(PresetSound.blockPick).isHidden = true;
    AudioStorage.instance.get(PresetSound.blockPut).isHidden = true;
    AudioStorage.instance.get(PresetSound.lock).isHidden = true;
    AudioStorage.instance.get(PresetSound.unlock).isHidden = true;
    AudioStorage.instance.get(PresetSound.sweep).isHidden = true
    AudioStorage.instance.get(PresetSound.puyon).isHidden = true;
    AudioStorage.instance.get(PresetSound.surprise).isHidden = true;
    AudioStorage.instance.get(PresetSound.coinToss).isHidden = true;
    AudioStorage.instance.get(PresetSound.sweep).isHidden = true;
    AudioStorage.instance.get(PresetSound.selectionStart).isHidden = true;

    PeerCursor.createMyCursor().then(() => {
      if (PeerCursor.myCursor.name == null || PeerCursor.myCursor.name === '') PeerCursor.myCursor.name = PeerCursor.CHAT_DEFAULT_NAME;
      if (!PeerCursor.myCursor.imageIdentifier) PeerCursor.myCursor.imageIdentifier = noneIconImage.identifier;
    });

    EventSystem.register(this)
      .on('UPDATE_GAME_OBJECT', event => { this.lazyNgZoneUpdate(event.isSendFromSelf); })
      .on('DELETE_GAME_OBJECT', event => { this.lazyNgZoneUpdate(event.isSendFromSelf); })
      .on('UPDATE_SELECTION', event => { this.lazyNgZoneUpdate(event.isSendFromSelf); })
      .on('SYNCHRONIZE_AUDIO_LIST', event => { if (event.isSendFromSelf) this.lazyNgZoneUpdate(false); })
      .on('SYNCHRONIZE_FILE_LIST', event => { if (event.isSendFromSelf) this.lazyNgZoneUpdate(false); })
      .on<AppConfig>('LOAD_CONFIG', event => {
        console.log('LOAD_CONFIG !!!', event.data);
        if (event.data.dice && event.data.dice.url) {
          const API_VERSION = event.data.dice.api;
          const langSortOrder = ['A', 'English', 'ChineseTraditional', 'SimplifiedChinese', 'Korean', 'Other'];
          //console.log(api)
          //ToDO BCDice-API관리자 정보 표시를 위한 좋은 UI 가 생각나지 않기 때문에 보류
          //fetch(event.data.dice.url + '/v1/admin', {mode: 'cors'})
          //  .then(response => { return response.json() })
          //  .then(infos => { DiceBot.adminUrl = infos.url });
          fetch(event.data.dice.url + (API_VERSION == 1 ? '/v1/names' : '/v2/game_system'), {mode: 'cors'})
            .then(response => { return response.json() })
            .then(infos => {
              let apiUrl = event.data.dice.url;
              DiceBot.apiUrl = apiUrl.endsWith('/') ? apiUrl.substring(0, apiUrl.length - 1) : apiUrl;
              DiceBot.apiVersion = API_VERSION;
              DiceBot.diceBotInfos = [];
              let tempInfos = (API_VERSION == 1 ? infos.names : infos.game_system)
                .filter(info => (API_VERSION == 1 ? info.system : info.id) != 'DiceBot')
                .map(info => {
                  let normalize = (info.sort_key && info.sort_key.indexOf('국제화') < 0) ? info.sort_key : info.name.normalize('NFKD');
                  for (let replaceData of DiceBot.replaceData) {
                    if (replaceData[2] && info.name === replaceData[0]) {
                      normalize = replaceData[1];
                      info.name = replaceData[2];
                    }
                    normalize = normalize.split(replaceData[0].normalize('NFKD')).join(replaceData[1].normalize('NFKD'));
                  }
                  info.normalize = normalize.replace(/[\u3041-\u3096]/g, m => String.fromCharCode(m.charCodeAt(0) + 0x60))
                    .replace(/제(.+?)판/g, '제$1판')
                    .replace(/[・!?！？\s　:：=＝\/／（）\(\)]+/g, '')
                    .replace(/([아카사타나하마야라와])ー+/g, '$1아')
                    .replace(/([이키시치니히미리])ー+/g, '$1이')
                    .replace(/([우쿠스츠누후무유루])ー+/g, '$1우')
                    .replace(/([에케세테네헤메레])ー+/g, '$1에')
                    .replace(/([오코소토노호모요로])ー+/g, '$1오')
                    .replace(/응+ー+/g, '응')
                    .replace(/응+/g, '응');
                  return info;
                })
                .map(info => {
                  const lang = /.+\:(.+)/.exec((API_VERSION == 1 ? info.system : info.id));
                  info.lang = lang ? lang[1] : 'A';
                  return info;
                })
                .sort((a, b) => {
                  return langSortOrder.indexOf(a.lang) < langSortOrder.indexOf(b.lang) ? -1 
                    : a.normalize == b.normalize ? 0 
                    : a.normalize < b.normalize ? -1 : 1;
                });
              DiceBot.diceBotInfos = [];
              DiceBot.diceBotInfosIndexed = [];
              DiceBot.diceBotInfos.push(...tempInfos.map(info => { return { id: (API_VERSION == 1 ? info.system : info.id), game: info.name } }));
              if (tempInfos.length > 0) {
                let sentinel = tempInfos[0].normalize.substring(0, 1);
                let group = { index: tempInfos[0].normalize.substring(0, 1), infos: [] };
                for (let info of tempInfos) {
                  let index = info.lang == 'Other' ? '그외' 
                    : info.lang == 'ChineseTraditional' ? '정체중문'
                    : info.lang == 'Korean' ? '한국어'
                    : info.lang == 'English' ? 'English'
                    : info.lang == 'SimplifiedChinese' ? '간체중문'
                    : info.normalize.substring(0, 1);
                  if (index !== sentinel) {
                    sentinel = index;
                    DiceBot.diceBotInfosIndexed.push(group);
                    group = { index: index, infos: [] };
                  }
                  group.infos.push({ script: (API_VERSION == 1 ? info.system : info.id), game: info.name });
                }
                DiceBot.diceBotInfosIndexed.push(group);
                DiceBot.diceBotInfosIndexed.sort((a, b) => a.index == b.index ? 0 : a.index < b.index ? -1 : 1);
              }
            });
        } else {
          DiceBot.diceBotInfos.forEach((info) => {
            let normalize = info.sort_key.normalize('NFKD');
            if (a.sort_key == 'Other' && b.sort_key == 'Other') {
              return 0;
            } else if (a.sort_key == 'Other') {
              return 1;
            }
            return a.sort_key == b.sort_key ? 0 
        }
        console.log('LOAD_CONFIG !!!');
        Network.configure(event.data);
        Network.open();
      })
      .on<File>('FILE_LOADED', event => {
        this.lazyNgZoneUpdate(false);
      })
      .on('OPEN_NETWORK', event => {
        console.log('OPEN_NETWORK', event.data.peerId);
        PeerCursor.myCursor.peerId = Network.peer.peerId;
        PeerCursor.myCursor.userId = Network.peer.userId;
        this.isLoggedin = false;
      })
      .on('NETWORK_ERROR', event => {
        console.log('NETWORK_ERROR', event.data.peerId);
        let errorType: string = event.data.errorType;
        let errorMessage: string = event.data.errorMessage;

        this.ngZone.run(async () => {
          //SKyWayエラーハンドリング
          let quietErrorTypes = ['peer-unavailable'];
          let reconnectErrorTypes = ['disconnected', 'socket-error', 'unavailable-id', 'authentication', 'server-error'];

          if (quietErrorTypes.includes(errorType)) return;
          await this.modalService.open(TextViewComponent, { title: '네트워크 에러', text: errorMessage });

          if (!reconnectErrorTypes.includes(errorType)) return;
          await this.modalService.open(TextViewComponent, { title: '네트워크 에러', text: '이 창을 닫으면 다시 접속을 시도합니다.' });
          Network.open();
          this.isLoggedin = false;
        });
      })
      .on('CONNECT_PEER', event => {
        if (event.isSendFromSelf) { 
          this.chatMessageService.calibrateTimeOffset();
          if (!this.isLoggedin) {
            this.isLoggedin = true;
            chatMessageService.sendOperationLog((Network.peer.isRoom ? Network.peer.roomName + ' 에': '다른 사람과') + '접속했다');
          }
        }
        this.lazyNgZoneUpdate(event.isSendFromSelf);
      })
      .on('DISCONNECT_PEER', event => {
        this.lazyNgZoneUpdate(event.isSendFromSelf);
        if (event.isSendFromSelf) this.isLoggedin = false;
      })
      .on('MESSAGE_NORTIFICATION', event => {
        //console.log(event)
        /* 보류
        try {
          Notification.requestPermission().then((permission) => {
            if (permission === 'granted') {
              const tab = <ChatTab>ObjectStore.instance.get(event.data.tabIdentifier);
              const message = <ChatMessage>ObjectStore.instance.get(event.data.messageIdentifier);
              if (tab && message) {
                const option: { body: string, icon?: string, tag?: string } = { body: message.plainText(), tag: 'chat-message' };
                const image = message.image;
                if (image) option.icon = message.image.url;
                const notification = new Notification(tab.name + ' - ' + message.name + (message.toColor ? (' ➡ ' + message.toName + ' (은닉)') : ''), option);
                document.addEventListener('visibilitychange', () => {
                  if (document.visibilityState === 'visible') notification.close();
                });
              }
            }
          });
        } catch(e) {
          console.log(e);
        }
        */
        // UI컴포넌트로 설정할 수 있도록 해야하는가
        if (ChatWindowComponent.isNoticeOn) {
          if (event.data?.isDirect || !this.noticeIntervalTimer) {
            clearTimeout(this.noticeIntervalTimer);
            this.noticeIntervalTimer = setTimeout(() => {
              clearTimeout(this.noticeIntervalTimer);
              this.noticeIntervalTimer = null;
            }, 100);
            this.notice();
          }
        } else if (this.noticeIntervalTimer) {
          clearTimeout(this.noticeIntervalTimer);
          this.noticeIntervalTimer = null;
        }
      })
      .on('PLAY_CUT_IN', -1000, event => {
        let cutIn = ObjectStore.instance.get<CutIn>(event.data.identifier);
        this.cutInService.play(cutIn, event.data.secret ? event.data.secret : false, event.data.test ? event.data.test : false, event.data.sender);
      })
      .on('STOP_CUT_IN', -1000, event => {
        this.cutInService.stop(event.data.identifier);
      })
      .on('POPUP_STAND_IMAGE', -1000, event => {
        let standElement = ObjectStore.instance.get<DataElement>(event.data.standIdentifier);
        let gameCharacter = ObjectStore.instance.get<GameCharacter>(event.data.characterIdentifier);
        this.standImageService.show(gameCharacter, standElement, event.data.color ? event.data.color : null, event.data.secret);
      })
      .on('FAREWELL_STAND_IMAGE', -1000, event => {
        this.standImageService.farewell(event.data.characterIdentifier);
      })
      .on('DELETE_STAND_IMAGE', -1000, event => {
        this.standImageService.destroy(event.data.characterIdentifier, event.data.identifier);
      })
      .on('DESTORY_STAND_IMAGE_ALL', -1000, event => {
        this.standImageService.destroyAll();
      });

    workaroundForMobileSafari();
  }
  
  private static readonly beforeUnloadProc = (event) => {
    event.preventDefault();
    event.returnValue = '';
  };

  ngOnInit() {
    window.addEventListener('beforeunload', AppComponent.beforeUnloadProc);
  }

  ngAfterViewInit() {
    PanelService.defaultParentViewContainerRef = ModalService.defaultParentViewContainerRef = ContextMenuService.defaultParentViewContainerRef = StandImageService.defaultParentViewContainerRef = CutInService.defaultParentViewContainerRef = this.modalLayerViewContainerRef;
    queueMicrotask(() => {
      this.panelService.open(PeerMenuComponent, { width: 520, height: 450, left: 100 });
      this.panelService.open(ChatWindowComponent, { width: 700, height: 400, left: 100, top: 450 });
    });
    
    // PWA
    let notification: Notification;
    this.swUpdate.versionUpdates.subscribe(event => {
      switch (event.type) {
        case 'VERSION_DETECTED':
          console.log(`Downloading new app version: ${event.version.hash}`);
          Notification.requestPermission().then((permission) => {
            if (permission === 'granted') {
              notification = new Notification('Udonarium with Fly', { 
                body: 'Udonarium with Fly의 새로운 버전을 다운로드 중입니다.',
                icon: 'card.png'
              });
              notification.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (notification) {
                  notification.close();
                  notification = null;
                }
                return false;
              });
            }
          });
          break;
        case 'VERSION_READY':
          console.log(`Current app version: ${event.currentVersion.hash}`);
          console.log(`New app version ready for use: ${event.latestVersion.hash}`);
          if (!this.isUpdateCanceled) {
            this.modalService.open(ConfirmationComponent, {
              title: 'Udonarium with Fly의 갱신', 
              text: 'Udonarium with Fly의 새 버전을 다운로드했습니다. 갱신을 진행할까요?',
              helpHtml: '<b style="color: red">갱신 중에 페이지를 다시 불러옵니다.</b>수동으로 다시 불러오는 것으로도 갱신 가능합니다.',
              type: ConfirmationType.OK_CANCEL,
              materialIcon: 'browser_updated',
              action: () => {
                this.swUpdate.activateUpdate().then(() => {
                  window.removeEventListener('beforeunload', AppComponent.beforeUnloadProc);
                  document.location.reload();
                });
              },
              cancelAction: () => {
                this.isUpdateCanceled = true;
              }
            });
          }
          break;
        case 'VERSION_INSTALLATION_FAILED':
          console.log(`Failed to install app version '${event.version.hash}': ${event.error}`);
          break;
      }
    });
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
    if (this.noticeIntervalTimer) clearTimeout(this.noticeIntervalTimer);
  }

  open(componentName: string) {
    let component: { new(...args: any[]): any } = null;
    let option: PanelOption = { width: 450, height: 600, left: 100 }
    switch (componentName) {
      case 'PeerMenuComponent':
        option.width = 520;
        component = PeerMenuComponent;
        break;
      case 'ChatWindowComponent':
        component = ChatWindowComponent;
        option.width = 700;
        break;
      case 'GameTableSettingComponent':
        component = GameTableSettingComponent;
        option = { width: 610, height: 540, left: 100 };
        break;
      case 'FileStorageComponent':
        component = FileStorageComponent;
        option.width = 700;
        break;
      case 'GameCharacterSheetComponent':
        component = GameCharacterSheetComponent;
        break;
      case 'JukeboxComponent':
        component = JukeboxComponent;
        option.height = 540;
        break;
      case 'GameObjectInventoryComponent':
        component = GameObjectInventoryComponent;
        break;
      case 'DiceRollTableSettingComponent':
        component = DiceRollTableSettingComponent;
        option = { width: 645, height: 475 };
        break;
      case 'CutInSettingComponent':
        component = CutInSettingComponent;
        option = { width: 700, height: 600 };
        break;
    }
    if (component) {
      option.top = (this.openPanelCount % 10 + 1) * 20;
      option.left = 100 + (this.openPanelCount % 20 + 1) * 5;
      this.openPanelCount = this.openPanelCount + 1;
      this.panelService.open(component, option);
    }
  }

  async save() {
    if (this.isSaveing) return;
    this.isSaveing = true;
    this.progresPercent = 0;
    let roomName = 0 < Network.peer.roomName.length
      ? Network.peer.roomName
      : 'fly_ルームデータ';
    await this.saveDataService.saveRoomAsync(roomName, percent => {
      this.progresPercent = percent;
    });

    setTimeout(() => {
      this.isSaveing = false;
      this.progresPercent = 0;
    }, 500);
  }

  handleFileSelect(event: Event) {
    let input = <HTMLInputElement>event.target;
    let files = input.files;
    if (files.length) FileArchiver.instance.load(files);
    input.value = '';
  }

  private lazyNgZoneUpdate(isImmediate: boolean) {
    if (isImmediate) {
      if (this.immediateUpdateTimer !== null) return;
      this.immediateUpdateTimer = setTimeout(() => {
        this.immediateUpdateTimer = null;
        if (this.lazyUpdateTimer != null) {
          clearTimeout(this.lazyUpdateTimer);
          this.lazyUpdateTimer = null;
        }
        this.ngZone.run(() => { });
      }, 0);
    } else {
      if (this.lazyUpdateTimer !== null) return;
      this.lazyUpdateTimer = setTimeout(() => {
        this.lazyUpdateTimer = null;
        if (this.immediateUpdateTimer != null) {
          clearTimeout(this.immediateUpdateTimer);
          this.immediateUpdateTimer = null;
        }
        this.ngZone.run(() => { });
      }, 100);
    }
  }

  toolBox(event: Event) {
    const button = <HTMLElement>event.target;
    const clientRect = button.getBoundingClientRect();
    const position = { 
      x: window.pageXOffset + clientRect.left + (this.isHorizontal ? 0 : button.clientWidth * 0.9), 
      y: window.pageYOffset + clientRect.top + (this.isHorizontal ? button.clientHeight * 0.9 : 0)
    };
    const menu = [];
    const cunIns = CutInList.instance.cutIns;
    menu.push({ name: '컷인 재생', materialIcon: 'play_arrow',
      action: null, subActions: cunIns.length === 0 ? [
        {
          name: '(컷인 없음)',
          disabled: true,
          center: true
        }
      ] : cunIns.map(cutIn => {
        return { 
          name: `${cutIn.isValidAudio ? '' : '⚠️'}${cutIn.name == '' ? '(이름 없는 컷인)' : cutIn.name}`, 
          subActions: [{
              name: '전원',
              action: () => {
                EventSystem.call('PLAY_CUT_IN', {
                  identifier: cutIn.identifier,
                  secret: false,
                  sender: PeerCursor.myCursor.peerId
                });
                this.chatMessageService.sendOperationLog((cutIn.name == '' ? '(이름 없는 컷인)' : cutIn.name) + ' 재생함');
              }
            }, ContextMenuSeparator, ...this.otherPeers.map(peer => {
            return {
              name: peer.name + (peer === PeerCursor.myCursor ? ' (당신)' : ''),
              color: peer.color,
              default: true,
              action: () => {
                if (peer !== PeerCursor.myCursor) {
                  EventSystem.call('PLAY_CUT_IN', {
                    identifier: cutIn.identifier,
                    secret: true,
                    sender: PeerCursor.myCursor.peerId
                  }, peer.peerId);
                }
                EventSystem.call('PLAY_CUT_IN', {
                  identifier: cutIn.identifier,
                  secret: true,
                  sender: PeerCursor.myCursor.peerId
                }, PeerCursor.myCursor.peerId);
              }
            }
          })]
        };
      })
    });
    menu.push(ContextMenuSeparator);
    menu.push({ name: '컷인 설정...', materialIcon: 'movie_creation', action: () => this.open('CutInSettingComponent') });
    menu.push({ name: '다이스봇 표 설정...', materialIcon: 'table_rows', action: () => this.open('DiceRollTableSettingComponent') })
    this.contextMenuService.open(position, menu, '도구 상자');
  }

      { name: '바로 위에서 내려다본다', action: () => EventSystem.trigger('RESET_POINT_OF_VIEW', 'top') }
  resetPointOfView(event: Event) {
    const button = <HTMLElement>event.target;
    const clientRect = button.getBoundingClientRect();
    const position = { 
      x: window.pageXOffset + clientRect.left + (this.isHorizontal ? 0 : button.clientWidth * 0.9), 
      y: window.pageYOffset + clientRect.top + (this.isHorizontal ? button.clientHeight * 0.9 : 0)
    };
    this.contextMenuService.open(position, [
      { name: '초기 시점으로 되돌리기', action: () => EventSystem.trigger('RESET_POINT_OF_VIEW', null) },
      { name: '바로 위에서 보기', action: () => EventSystem.trigger('RESET_POINT_OF_VIEW', 'top') }
    ], '시점 리셋');
  }

  standSetteings(event: Event) {
    const button = <HTMLElement>event.target;
    const clientRect = button.getBoundingClientRect();
    const position = { 
      x: window.pageXOffset + clientRect.left + (this.isHorizontal ? 0 : button.clientWidth * 0.9), 
      y: window.pageYOffset + clientRect.top + (this.isHorizontal ? button.clientHeight * 0.9 : 0)
    };
    const isShowStand = StandImageComponent.isShowStand;
    const isShowNameTag = StandImageComponent.isShowNameTag;
    const isCanBeGone = StandImageComponent.isCanBeGone; 
    this.contextMenuService.open(this.pointerDeviceService.pointers[0], [
      { name: `${ TableSelecter.instance.gridShow ? '☑' : '☐' }테이블 그리드를 항상 표시`, 
          EventSystem.trigger('UPDATE_GAME_OBJECT', TableSelecter.instance.toContext()); 
      },
      { name: `${ TableSelecter.instance.gridSnap ? '☑' : '☐' }오브젝트 이동 시에 스냅`, 
        action: () => {
          TableSelecter.instance.gridSnap = !TableSelecter.instance.gridSnap;
        },
        checkBox: 'check'
      },
      ContextMenuSeparator,
      { name: `${ ChatWindowComponent.isNoticeOn ? '☑' : '☐' }채팅을 받았을 때 소리로 알림`, 
        action: () => {
          ChatWindowComponent.isNoticeOn = !ChatWindowComponent.isNoticeOn;
        },
        checkBox: 'check'
      },
      ContextMenuSeparator,
      { name: `${ isShowStand ? '☑' : '☐' }스탠드 표시`, 
        action: () => {
          StandImageComponent.isShowStand = !isShowStand;
      },
      { name: `${ isShowNameTag ? '☑' : '☐' }네임태그 표시`, 
        action: () => {
          StandImageComponent.isShowNameTag = !isShowNameTag;
        },
        level: 1,
        disabled: !StandImageComponent.isShowStand,
        checkBox: 'check'
      },
      { name: `${ isCanBeGone ? '☑' : '☐' }투명화, 자동 퇴장`, 
        action: () => {
          StandImageComponent.isCanBeGone = !isCanBeGone;
        },
        level: 1,
        disabled: !StandImageComponent.isShowStand,
        checkBox: 'check'
      },
      ContextMenuSeparator,
      { name: '표시 스탠드 전부 삭제', action: () => EventSystem.trigger('DESTORY_STAND_IMAGE_ALL', null) }
    ], '개인 설정');
  }
/*
  farewellStandAll() {
    EventSystem.trigger('DESTORY_STAND_IMAGE_ALL', null);
  }
*/
  diceAllOpne() {
    this.modalService.open(ConfirmationComponent, {
      title: '다이스 일괄 공개', 
      text: '테이블 위의 다이스, 코인을 공개합니까?',
      help: '「일괄 공개하지 않음」설정을 한 것은 공개되지 않습니다.',
      type: ConfirmationType.OK_CANCEL,
      materialIcon: 'all_out',
      action: () => {
        EventSystem.trigger('DICE_ALL_OPEN', null);
      }
    });
  }
  deleteGameObject(gameObject: any) {
    throw new Error('Method not implemented.');
  }

  rotateChange(isHorizontal) {
    this.isHorizontal = isHorizontal;
  }

  closeImagePreview() {
    URL.revokeObjectURL(AppComponent.imageUrl);
    AppComponent.imageUrl = '';
  }
}

PanelService.UIPanelComponentClass = UIPanelComponent;
//ContextMenuService.UIPanelComponentClass = ContextMenuComponent;
ContextMenuService.ContextMenuComponentClass = ContextMenuComponent;
ModalService.ModalComponentClass = ModalComponent;

function workaroundForMobileSafari() {
  // Mobile Safari (iOS 16.4)에서 확인한 문제의 workaround.
  // chrome-smooth-image-trick이 CSS애니메이션(keyframes)의 거동에 악영향을 주므로 수정용 CSS로 덮어쓴다.
  let ua = window.navigator.userAgent.toLowerCase();
  let isiOS = ua.indexOf('iphone') > -1 || ua.indexOf('ipad') > -1 || ua.indexOf('macintosh') > -1 && 'ontouchend' in document;
  if (isiOS) {
    let style = document.createElement('style');
    style.innerHTML = `
      .chrome-smooth-image-trick {
        transform-style: flat;
      }
      `;
    document.body.appendChild(style);
  }
}
