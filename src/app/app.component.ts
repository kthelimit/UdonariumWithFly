import { AfterViewInit, Component, NgZone, OnDestroy, OnInit, ViewChild, ViewContainerRef } from '@angular/core';

import { ChatTabList } from '@udonarium/chat-tab-list';
import { AudioPlayer } from '@udonarium/core/file-storage/audio-player';
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
import { GameCharacterGeneratorComponent } from 'component/game-character-generator/game-character-generator.component';
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

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('modalLayer', { read: ViewContainerRef, static: true }) modalLayerViewContainerRef: ViewContainerRef;
  private immediateUpdateTimer: NodeJS.Timer = null;
  private lazyUpdateTimer: NodeJS.Timer = null;
  private openPanelCount: number = 0;
  isSaveing: boolean = false;
  progresPercent: number = 0;

  isHorizontal = false;
  isLoggedin = false;
  isUpdateCanceled = false;
  
  get otherPeers(): PeerCursor[] { return ObjectStore.instance.getObjects(PeerCursor); }

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

    let diceBot: DiceBot = new DiceBot('DiceBot');
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
    sampleDiceRollTable.value = "1:이것은 다이스봇 표의 샘플입니다.\n2:숫자와 대응하는 결과를 1줄에 1개씩 :(콜론)으로 구분하고\n3:숫자:결과의 형태로 작성합니다.\n4:\\\\n  \\n으로 행을 바꿉니다.\n5-6:또, -（하이픈）으로 구분해서 숫자의 범위를 지정할 수 있습니다.";
    DiceRollTableList.instance.addDiceRollTable(sampleDiceRollTable);

    let fileContext = ImageFile.createEmpty('none_icon').toContext();
    fileContext.url = './assets/images/ic_account_circle_black_24dp_2x.png';
    let noneIconImage = ImageStorage.instance.add(fileContext);
    ImageTag.create(noneIconImage.identifier).tag = '*default 아이콘';

    fileContext = ImageFile.createEmpty('stand_no_image').toContext();
    fileContext.url = './assets/images/nc96424.png';
    let standNoIconImage = ImageStorage.instance.add(fileContext);
    ImageTag.create(standNoIconImage.identifier).tag = '*default 스탠딩';

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

    PeerCursor.createMyCursor();
    if (!PeerCursor.myCursor.name) PeerCursor.myCursor.name = '플레이어';
    PeerCursor.myCursor.imageIdentifier = noneIconImage.identifier;

    EventSystem.register(this)
      .on('UPDATE_GAME_OBJECT', event => { this.lazyNgZoneUpdate(event.isSendFromSelf); })
      .on('DELETE_GAME_OBJECT', event => { this.lazyNgZoneUpdate(event.isSendFromSelf); })
      .on('SYNCHRONIZE_AUDIO_LIST', event => { if (event.isSendFromSelf) this.lazyNgZoneUpdate(false); })
      .on('SYNCHRONIZE_FILE_LIST', event => { if (event.isSendFromSelf) this.lazyNgZoneUpdate(false); })
      .on<AppConfig>('LOAD_CONFIG', event => {
        console.log('LOAD_CONFIG !!!', event.data);
        if (event.data.dice && event.data.dice.url) {
          const API_VERSION = event.data.dice.api;
          //console.log(api)
          //ToDO BCDice-API管理者情報表示の良いUI思いつかないのでペンディング
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
              //DiceBot.diceBotInfos.push(
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
                  return a.lang < b.lang ? -1 
                    : a.lang > b.lang ? 1
                    : a.normalize == b.normalize ? 0 
                    : a.normalize < b.normalize ? -1 : 1;
                });
              DiceBot.diceBotInfos.push(...tempInfos.map(info => { return { script: (API_VERSION == 1 ? info.system : info.id), game: info.name } }));
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
            for (let replaceData of DiceBot.replaceData) {
              if (replaceData[2] && info.game === replaceData[0]) {
                normalize = replaceData[1];
                info.game = replaceData[2];
              }
              normalize = normalize.split(replaceData[0].normalize('NFKD')).join(replaceData[1].normalize('NFKD'));
            }
            normalize = normalize.replace(/[\u3041-\u3096]/g, m => String.fromCharCode(m.charCodeAt(0) + 0x60))
              .replace(/제(.+?)판/g, '제$1판')
              .replace(/[・!?！？\s　:：=＝\/／（）\(\)]+/g, '')
              .replace(/([아카사타나하마야라와])ー+/g, '$1아')
              .replace(/([이키시치니히미리])ー+/g, '$1이')
              .replace(/([우쿠스츠누후무유루])ー+/g, '$1우')
              .replace(/([에케세테네헤메레])ー+/g, '$1에')
              .replace(/([오코소토노호모요로])ー+/g, '$1오')
              .replace(/응+ー+/g, '응')
              .replace(/응+/g, '응');
            info.sort_key = info.lang ? info.lang : normalize.normalize('NFKD');
            //return info;
            //console.log(info.index + ': ' + normalize);
          });
          DiceBot.diceBotInfos.sort((a, b) => {
            if (a.sort_key == 'Other' && b.sort_key == 'Other') {
              return 0;
            } else if (a.sort_key == 'Other') {
              return 1;
            } else if (b.sort_key == 'Other') {
              return -1;
            }
            return a.sort_key == b.sort_key ? 0 
            : a.sort_key < b.sort_key ? -1 : 1;
          });
          let sentinel = DiceBot.diceBotInfos[0].sort_key[0];
          let group = { index: sentinel, infos: [] };
          for (let info of DiceBot.diceBotInfos) {
            if (info.lang == 'Other') info.lang = '간체중문'; //手抜き
            if ((info.lang ? info.lang : info.sort_key[0]) !== sentinel) {
              sentinel = info.lang ? info.lang : info.sort_key[0];
              DiceBot.diceBotInfosIndexed.push(group);
              group = { index: sentinel, infos: [] };
            }
            group.infos.push({ script: info.id, game: info.game });
          }
          DiceBot.diceBotInfosIndexed.push(group);
        }
        DiceBot.diceBotInfosIndexed.sort((a, b) => a.index == b.index ? 0 : a.index < b.index ? -1 : 1);
        Network.setApiKey(event.data.webrtc.key);
        Network.open();
      })
      .on<File>('FILE_LOADED', event => {
        this.lazyNgZoneUpdate(false);
      })
      .on('OPEN_NETWORK', event => {
        console.log('OPEN_NETWORK', event.data.peerId);
        PeerCursor.myCursor.peerId = Network.peerContext.peerId;
        PeerCursor.myCursor.userId = Network.peerContext.userId;
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
            chatMessageService.sendOperationLog((Network.peerContext.isRoom ? Network.peerContext.roomName + ' 에': '다른 사람과') + '연결했다');
          }
        }
        this.lazyNgZoneUpdate(event.isSendFromSelf);
      })
      .on('DISCONNECT_PEER', event => {
        this.lazyNgZoneUpdate(event.isSendFromSelf);
        if (event.isSendFromSelf) this.isLoggedin = false;
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
  }
  
  private static readonly beforeUnloadProc = (evt) => {
    // Cancel the event as stated by the standard.
    evt.preventDefault();
    // Chrome requires returnValue to be set.
    evt.returnValue = '';
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

    this.swUpdate.versionUpdates.subscribe(evt => {
      switch (evt.type) {
        case 'VERSION_DETECTED':
          console.log(`Downloading new app version: ${evt.version.hash}`);
          break;
        case 'VERSION_READY':
          console.log(`Current app version: ${evt.currentVersion.hash}`);
          console.log(`New app version ready for use: ${evt.latestVersion.hash}`);
          if (!this.isUpdateCanceled) {
            this.modalService.open(ConfirmationComponent, {
              title: 'Udonarium with Fly 의 갱신', 
              text: 'Udonarium with Fly의 새로운 버전이 공개되어 있습니다. 갱신을 실시합니까?',
              help: '갱신 시 페이지를 다시 불러옵니다. 수동으로 다시 불러오는 것으로도 갱신이 가능합니다.',
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
          console.log(`Failed to install app version '${evt.version.hash}': ${evt.error}`);
          break;
      }
    });
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
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
        option = { width: 610, height: 400, left: 100 };
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
        break;
      case 'GameCharacterGeneratorComponent':
        component = GameCharacterGeneratorComponent;
        option = { width: 500, height: 300, left: 100 };
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

    let roomName = Network.peerContext && 0 < Network.peerContext.roomName.length
      ? Network.peerContext.roomName
      : 'fly_방데이터';
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

  toolBox() {
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
          name: `${cutIn.isValidAudio ? '' : '⚠️'}${cutIn.name == '' ? '(이름없는 컷인)' : cutIn.name}`, 
          subActions: [{
              name: '전원',
              action: () => {
                EventSystem.call('PLAY_CUT_IN', {
                  identifier: cutIn.identifier,
                  secret: false,
                  sender: PeerCursor.myCursor.peerId
                })
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
    menu.push({ name: '컷인 설정', materialIcon: 'movie_creation', action: () => this.open('CutInSettingComponent') });
    menu.push({ name: '다이스봇 표 설정', materialIcon: 'table_rows', action: () => this.open('DiceRollTableSettingComponent') })
    this.contextMenuService.open(this.pointerDeviceService.pointers[0], menu, '툴 박스');
  }

  resetPointOfView() {
    this.contextMenuService.open(this.pointerDeviceService.pointers[0], [
      { name: '초기시점으로 되돌린다', action: () => EventSystem.trigger('RESET_POINT_OF_VIEW', null) },
      { name: '바로 위에서 내려다본다', action: () => EventSystem.trigger('RESET_POINT_OF_VIEW', 'top') }
    ], '시점 리셋');
  }

  standSetteings() {
    const isShowStand = StandImageComponent.isShowStand;
    const isShowNameTag = StandImageComponent.isShowNameTag;
    const isCanBeGone = StandImageComponent.isCanBeGone; 
    this.contextMenuService.open(this.pointerDeviceService.pointers[0], [
      { name: `${ TableSelecter.instance.gridShow ? '☑' : '☐' }테이블 그리드를 항상 표시`, 
      action: () => {
        TableSelecter.instance.gridShow = !TableSelecter.instance.gridShow;
        EventSystem.trigger('UPDATE_GAME_OBJECT', TableSelecter.instance.toContext()); 
      }
      },
      { name: `${ TableSelecter.instance.gridSnap ? '☑' : '☐' }오브젝트 이동 시에 스냅`, 
      action: () => {
        TableSelecter.instance.gridSnap = !TableSelecter.instance.gridSnap;
      }
      },
      ContextMenuSeparator,
      { name: `${ isShowStand ? '☑' : '☐' }스탠딩 표시`, 
        action: () => {
          StandImageComponent.isShowStand = !isShowStand;
        }
      },
      { name: `${ isShowNameTag ? '☑' : '☐' }네임태그 표시`, 
        action: () => {
          StandImageComponent.isShowNameTag = !isShowNameTag;
        },
        level: 1,
        disabled: !StandImageComponent.isShowStand
      },
      { name: `${ isCanBeGone ? '☑' : '☐' }투명화, 자동 퇴거`, 
        action: () => {
          StandImageComponent.isCanBeGone = !isCanBeGone;
        },
        level: 1,
        disabled: !StandImageComponent.isShowStand
      },
      ContextMenuSeparator,
      { name: '표시 스탠딩 전부 삭제', action: () => EventSystem.trigger('DESTORY_STAND_IMAGE_ALL', null) }
    ], '개인 설정');
  }
/*
  farewellStandAll() {
    EventSystem.trigger('DESTORY_STAND_IMAGE_ALL', null);
  }
*/
  diceAllOpne() {
    this.modalService.open(ConfirmationComponent, {
      title: '다이스를 한번에 공개', 
      text: '테이블 위의 다이스, 코인을 한번에 공개합니까?',
      help: '「함께 공개하지 않는다」설정을 한 것은 공개되지 않습니다.',
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
}

PanelService.UIPanelComponentClass = UIPanelComponent;
//ContextMenuService.UIPanelComponentClass = ContextMenuComponent;
ContextMenuService.ContextMenuComponentClass = ContextMenuComponent;
ModalService.ModalComponentClass = ModalComponent;
