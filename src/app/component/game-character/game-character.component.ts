import { animate, keyframes, style, transition, trigger } from '@angular/animations';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild, ElementRef, AfterViewInit
} from '@angular/core';
import { ImageFile } from '@udonarium/core/file-storage/image-file';
import { ObjectNode } from '@udonarium/core/synchronize-object/object-node';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { EventSystem, Network } from '@udonarium/core/system';
import { GameCharacter } from '@udonarium/game-character';
import { PresetSound, SoundEffect } from '@udonarium/sound-effect';
import { ChatPaletteComponent } from 'component/chat-palette/chat-palette.component';
import { GameCharacterSheetComponent } from 'component/game-character-sheet/game-character-sheet.component';
import { MovableOption } from 'directive/movable.directive';
import { RotableOption } from 'directive/rotable.directive';
import { ContextMenuSeparator, ContextMenuService } from 'service/context-menu.service';
import { PanelOption, PanelService } from 'service/panel.service';
import { PointerDeviceService } from 'service/pointer-device.service';
import { PeerCursor } from '@udonarium/peer-cursor';
import { StringUtil } from '@udonarium/core/system/util/string-util';
import { ImageStorage } from '@udonarium/core/file-storage/image-storage';
import { ModalService } from 'service/modal.service';
import { OpenUrlComponent } from 'component/open-url/open-url.component';
import { StandSettingComponent } from 'component/stand-setting/stand-setting.component';
import { ConfirmationComponent, ConfirmationType } from 'component/confirmation/confirmation.component';

@Component({
  selector: 'game-character',
  templateUrl: './game-character.component.html',
  styleUrls: ['./game-character.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('switchImage', [
      transition(':increment, :decrement', [
        animate('400ms ease', keyframes([
          style({ transform: 'scale3d(0.8, 0.8, 0.8) rotateY(0deg)' }),
          style({ transform: 'scale3d(1.2, 1.2, 1.2) rotateY(180deg)' }),
          style({ transform: 'scale3d(1.0, 1.0, 1.0) rotateY(360deg)' })
        ]))
      ])
    ]),
    trigger('switchImageShadow', [
      transition(':increment, :decrement', [
        animate('400ms ease', keyframes([
          style({ transform: 'scale3d(0.8, 0.8, 0.8)' }),
          style({ transform: 'scale3d(0, 1.2, 1.2)' }),
          style({ transform: 'scale3d(1.0, 1.0, 1.0)' })
        ]))
      ])
    ]),
    trigger('switchImagePedestal', [
      transition(':increment, :decrement', [
        animate('400ms ease', keyframes([
          style({ transform: 'scale3d(0, 0, 0)' }),
          style({ transform: 'scale3d(1.2, 1.2, 1.2)' }),
          style({ transform: 'scale3d(1.0, 1.0, 1.0)' })
        ]))
      ])
    ]),
    trigger('bounceInOut', [
      transition('void => *', [
        animate('600ms ease', keyframes([
          style({ transform: 'scale3d(0, 0, 0)', offset: 0 }),
          style({ transform: 'scale3d(1.5, 1.5, 1.5)', offset: 0.5 }),
          style({ transform: 'scale3d(0.75, 0.75, 0.75)', offset: 0.75 }),
          style({ transform: 'scale3d(1.125, 1.125, 1.125)', offset: 0.875 }),
          style({ transform: 'scale3d(1.0, 1.0, 1.0)', offset: 1.0 })
        ]))
      ]),
      transition('* => void', [
        animate(100, style({ transform: 'scale3d(0, 0, 0)' }))
      ])
    ]),
    trigger('fadeAndScaleInOut', [
      transition('void => *, true => false', [
        animate('200ms ease-in-out', keyframes([
          style({ transform: 'scale3d(0, 0, 0)', opacity: 0  }),
          style({ transform: 'scale3d(1.0, 1.0, 1.0)', opacity: 0.8 }),
        ]))
      ]),
      transition('* => void, true => false', [
        animate('100ms ease-in-out', style({ transform: 'scale3d(0, 0, 0)', opacity: 0 }))
      ])
    ])
  ]
})
export class GameCharacterComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() gameCharacter: GameCharacter = null;
  @Input() is3D: boolean = false;

  get name(): string { return this.gameCharacter.name; }
  get size(): number { return this.adjustMinBounds(this.gameCharacter.size); }
  get altitude(): number { return this.gameCharacter.altitude; }
  set altitude(altitude: number) { this.gameCharacter.altitude = altitude; }
  get height(): number { return this.adjustMinBounds(this.gameCharacter.height); }

  get imageFile(): ImageFile { return this.gameCharacter.imageFile; }
  get rotate(): number { return this.gameCharacter.rotate; }
  set rotate(rotate: number) { this.gameCharacter.rotate = rotate; }
  get roll(): number { return this.gameCharacter.roll; }
  set roll(roll: number) { this.gameCharacter.roll = roll; }
  get isDropShadow(): boolean { return this.gameCharacter.isDropShadow; }
  set isDropShadow(isDropShadow: boolean) { this.gameCharacter.isDropShadow = isDropShadow; }
  get isAltitudeIndicate(): boolean { return this.gameCharacter.isAltitudeIndicate; }
  set isAltitudeIndicate(isAltitudeIndicate: boolean) { this.gameCharacter.isAltitudeIndicate = isAltitudeIndicate; }
  get isInverse(): boolean { return this.gameCharacter.isInverse; }
  set isInverse(isInverse: boolean) { this.gameCharacter.isInverse = isInverse; }
  get isHollow(): boolean { return this.gameCharacter.isHollow; }
  set isHollow(isHollow: boolean) { this.gameCharacter.isHollow = isHollow; }
  get isBlackPaint(): boolean { return this.gameCharacter.isBlackPaint; }
  set isBlackPaint(isBlackPaint: boolean) { this.gameCharacter.isBlackPaint = isBlackPaint; }
  get aura(): number { return this.gameCharacter.aura; }
  set aura(aura: number) { this.gameCharacter.aura = aura; }

  get isNotRide(): boolean { return this.gameCharacter.isNotRide; }
  set isNotRide(isNotRide: boolean) { this.gameCharacter.isNotRide = isNotRide; }
  get isUseIconToOverviewImage(): boolean { return this.gameCharacter.isUseIconToOverviewImage; }
  set isUseIconToOverviewImage(isUseIconToOverviewImage: boolean) { this.gameCharacter.isUseIconToOverviewImage = isUseIconToOverviewImage; }

  get ownerName(): string { return this.gameCharacter.ownerName; }
  get ownerColor(): string { return this.gameCharacter.ownerColor; }
  get isHideIn(): boolean { return !!this.gameCharacter.owner; }
  get isVisible(): boolean { return this.gameCharacter.isVisible; }
  get isGMMode(): boolean{ return PeerCursor.myCursor ? PeerCursor.myCursor.isGMMode : false; }

  get faceIcon(): ImageFile { return this.gameCharacter.faceIcon; }
  
  get dialogFaceIcon(): ImageFile {
    if (!this.dialog || !this.dialog.faceIconIdentifier) return null;
    return ImageStorage.instance.get(<string>this.dialog.faceIconIdentifier);
  }

  get shadowImageFile(): ImageFile { return this.gameCharacter.shadowImageFile; }

  get elevation(): number {
    return +((this.gameCharacter.posZ + (this.altitude * this.gridSize)) / this.gridSize).toFixed(1);
  }

  gridSize: number = 50;
  math = Math;
  stringUtil = StringUtil;
  viewRotateX = 50;
  viewRotateZ = 10;
  heightWidthRatio = 1.5;
  //isRubied = false;

  set dialog(dialog) {
    if (!this.gameCharacter || this.gameCharacter.isHideIn) return;
    clearTimeout(this.dialogTimeOutId);
    clearInterval(this.chatIntervalId);
    let text = StringUtil.cr(dialog.text);
    const isEmote = StringUtil.isEmote(text);
    const rubys = [];
    const re = /[\|｜]([^\|｜\s]+?)《(.+?)》/g;
    let ary;
    let count = 0;
    let rubyLength = 0;

    if (!isEmote) {
      text = text.replace(/[。、]{3}/g, '…').replace(/[。、]{2}/g, '‥').replace(/(。|[\r\n]{2,})/g, "$1                            ").trimEnd(); //改行や。のあと時間を置くためのダーティハック
      while ((ary = re.exec(text)) !== null) {
        let offset = ary.index - (count * 3);
        rubys.push({base: ary[1], ruby: ary[2], start: offset - rubyLength, end: offset + ary[1].length - rubyLength - 1});
        count++;
        rubyLength += ary[2].length;
      }
    }
    //if (rubys.length > 0) this.isRubied = true; 

    let speechDelay = 1000 / Array.from(text).length > 36 ? 1000 / Array.from(text).length : 36;
    if (speechDelay > 200) speechDelay = 200;
    this.dialogTimeOutId = setTimeout(() => {
      this._dialog = null;
      this.gameCharacter.text = '';
      this.gameCharacter.isEmote = false; 
      //this.isRubied = false; 
      this.changeDetector.markForCheck();
    }, Array.from(text).length * speechDelay + 6000);

    this._dialog = dialog;
    this.gameCharacter.isEmote = isEmote;
    count = 0;
    let countLength = 0;
    let rubyCount = 0;
    let tmpText = '';
    let carrentRuby = rubys.shift();
    let rubyText = '';
    let isOpenRuby = false;
    if (isEmote) {
      this.gameCharacter.text = text;
      this.changeDetector.markForCheck();
    }  else {
      const charAry = Array.from(text.replace(/[\|｜]([^\|｜\s]+?)《.+?》/g, '$1'));
      this.chatIntervalId = setInterval(() => {
        let c = charAry[count];
        let isMulti = c.length > 1;
        if (c) {
            if (!isOpenRuby && carrentRuby && countLength >= carrentRuby.start) {
                tmpText += '<ruby>';
                isOpenRuby = true;
                rubyCount = 0;
            }
            tmpText += StringUtil.escapeHtml(c);
            if (isOpenRuby) {
                rubyCount += 1;
                let rt = carrentRuby.ruby;
                rubyText = '<rt>' + StringUtil.escapeHtml(Array.from(rt).slice(0, Math.ceil(Array.from(rt).length * (rubyCount / Array.from(carrentRuby.base).length))).join('')) + '</rt>'
            }
            if (isOpenRuby && carrentRuby && countLength >= carrentRuby.end - (isMulti ? 1 : 0)) {
                tmpText += (rubyText + '</ruby>');
                isOpenRuby = false;
                carrentRuby = rubys.shift(); 
            }
            countLength += c.length;
        }
        count += 1;
        this.gameCharacter.text = tmpText + (isOpenRuby ? (rubyText + '</ruby>') : '');
        this.changeDetector.markForCheck();
        if (count >= charAry.length) {
          clearInterval(this.chatIntervalId);
        }
        //countLength += c.length;
      }, speechDelay);
    }
  }

  get dialogText(): string {
    if (!this.gameCharacter || !this.gameCharacter.text) return '';
    const ary = this.gameCharacter.text.replace(/。/g, "。\n\n").split(/[\r\n]{2,}/g).filter(str => str.trim());
    return ary.length > 0 ? ary.reverse()[0].trim() : '';
  }
  
  get isRubied(): boolean {
    if (!this.gameCharacter || !this.gameCharacter.text) return false;
    return -1 < this.dialogText.indexOf('<ruby>');
  }

  get dialogChatBubbleMinWidth(): number {
    const max = this.characterImageWidth + 2.1 * this.gridSize;
    const existIcon = this.isUseFaceIcon && this.dialogFaceIcon && this.dialogFaceIcon.url;
    const dynamic = Array.from(this.dialogText).length * 11 + 52 + (existIcon ? 32 : 0);
    return max < dynamic ? max : dynamic; 
  }

  get dialog() {
    return this._dialog;
  }

  selected = false;
  private _dialog = null;
  private dialogTimeOutId = null;
  private chatIntervalId = null;

  get chatBubbleXDeg(): number {
    //console.log(this.viewRotateX)
    let ret = 90 - this.viewRotateX;
    if (ret < 0) ret = 360 + ret;
    ret = ret % 360;
    if (ret > 180) ret = -(180 - (ret - 180));
    //console.log(ret)
    // 補正
    if (ret > 90) ret = 90;
    if (ret < -90) ret = -90;
    return ret / 1.5;
  }

  @ViewChild('characterImage') characterImage: ElementRef;
  //@ViewChild('characterShadowImage') characterShadowImage: ElementRef;
  @ViewChild('chatBubble') chatBubble: ElementRef;

  //height = 0;
  naturalImageWidth = 0;
  naturalImageHeight = 0
  naturaHeightWidthRatio = 1;

  get characterImageHeight(): number {
    if (!this.characterImage || !this.naturalImageHeight) return 0;
    if (this.height > 0) return this.gridSize * this.height;
    let ratio = this.naturaHeightWidthRatio;
    if (ratio > this.heightWidthRatio) ratio = this.heightWidthRatio;
    return ratio * this.gridSize * this.size;
  }

  get characterImageWidth(): number {
    if (!this.characterImage || !this.naturalImageWidth) return 0;
    if (this.height <= 0) return this.gridSize * this.size;
    let ratio = this.naturaHeightWidthRatio;
    if (ratio > this.heightWidthRatio) ratio = this.heightWidthRatio;
    return this.gridSize * this.height / ratio;
  }

  get characterShadowImageHeight(): number {
    return this.characterImageHeight;
    /* ペンディング
    if (!this.characterShadowImage) return 0;
    if (this.height > 0) return this.gridSize * this.height;
    let ratio = this.characterShadowImage.nativeElement.naturalHeight / this.characterShadowImage.nativeElement.naturalWidth;
    if (ratio > this.heightWidthRatio) ratio = this.heightWidthRatio;
    return ratio * this.gridSize * this.size;
    */
  }

  get characterShadowImageWidth(): number {
    return this.characterImageWidth;
    /* ペンディング
    if (!this.characterShadowImage) return 0;
    if (this.height <= 0) return this.gridSize * this.size;
    let ratio = this.characterShadowImage.nativeElement.naturalHeight / this.characterShadowImage.nativeElement.naturalWidth;
    if (ratio > this.heightWidthRatio) ratio = this.heightWidthRatio;
    return this.gridSize * this.height / ratio;
    */
  }

  get characterShadowOffset(): number  {
    let offset = 0; 
    if (0.2 < this.height && this.height <= 0.3) {
      offset = 0.09;
    } else if (0.1 < this.height && this.height <= 0.2) {
      offset = 0.19;
    } else if (0 < this.height && this.height <= 0.1) {
      offset = 0.29;
    } 
    return (this.gridSize * this.size / 2) - (this.characterShadowImageHeight * 0.99) - (this.gridSize * offset);
  }

  get chatBubbleAltitude(): number {
    let cos =  Math.cos(this.roll * Math.PI / 180);
    let sin = Math.abs(Math.sin(this.roll * Math.PI / 180));
    if (cos < 0.5) cos = 0.5;
    if (sin < 0.5) sin = 0.5;
    const altitude1 = (this.characterImageHeight + (this.name ? 36 : 0)) * cos + 4;
    const altitude2 = (this.characterImageWidth / 2) * sin + 4 + this.characterImageWidth / 2;
    return altitude1 > altitude2 ? altitude1 : altitude2;
  }
  /*
  // 元の高さからマイナスする値
  get nameplateOffset(): number {
    return 0;
    if (!this.characterImage) return this.gridSize * this.size * this.heightWidthRatio;
    return this.gridSize * this.size * this.heightWidthRatio - this.characterImageHeight;
  }
  */
  get nameTagRotate(): number {
    let x = (this.viewRotateX % 360) - 90;
    let z = (this.viewRotateZ + this.rotate) % 360;
    let roll = this.roll % 360;
    z = (z > 0 ? z : 360 + z);
    roll = (roll > 0 ? roll : 360 + roll);
    return (x > 0 ? x : 360 + x) * (90 < z && z < 270 ? 1 : -1) * (90 <= roll && roll <= 270 ? -1 : 1);
  }

  get isListen(): boolean {
    return (this.dialog && this.dialog.text && !this.dialog.dialogTest && this.dialog.text.trim().length > 0);
  }

  get isWhisper(): boolean {
    return this.dialog && this.dialog.secret;
  }

  get isEmote(): boolean {
    return this.gameCharacter.isEmote;
    //return this.dialog && StringUtil.isEmote(this.dialog.text);
  }

  get isUseFaceIcon(): ImageFile {
    return this.dialog && this.dialog.faceIconIdentifier;
  }

  get dialogColor(): string {
    return (this.dialog && this.dialog.color) ? this.dialog.color : PeerCursor.CHAT_DEFAULT_COLOR;
  }

  movableOption: MovableOption = {};
  rotableOption: RotableOption = {};

  constructor(
    private contextMenuService: ContextMenuService,
    private panelService: PanelService,
    private changeDetector: ChangeDetectorRef,
    private pointerDeviceService: PointerDeviceService,
    private ngZone: NgZone,
    private modalService: ModalService
  ) { }
  
  ngOnInit() {
    EventSystem.register(this)
      .on('UPDATE_GAME_OBJECT', -1000, event => {
        let object = ObjectStore.instance.get(event.data.identifier);
        if (!this.gameCharacter || !object) return;
        if (this.gameCharacter === object || (object instanceof ObjectNode && this.gameCharacter.contains(object))) {
          if (this.gameCharacter.imageFiles.length <= 0) {
            this.naturalImageHeight = 0;
            this.naturalImageWidth = 0;
            this.naturaHeightWidthRatio = 1;
          }
          this.changeDetector.markForCheck();
        }
      })
      .on('SYNCHRONIZE_FILE_LIST', event => {
        this.changeDetector.markForCheck();
      })
      .on('UPDATE_FILE_RESOURE', -1000, event => {
        this.changeDetector.markForCheck();
      })
      .on<object>('TABLE_VIEW_ROTATE', -1000, event => {
        this.ngZone.run(() => {
          this.viewRotateX = event.data['x'];
          this.viewRotateZ = event.data['z'];
          this.changeDetector.markForCheck();
        });
      })
      .on<object>('SELECT_TABLETOP_OBJECT', -1000, event => {
        // とりあえず
        this.ngZone.run(() => {
          if (event.data['highlighting'] && event.data['identifier'] === this.gameCharacter.identifier) {
            this.selected = true;
          } else {
            this.selected = false;
          }
          this.changeDetector.markForCheck();
        });
      })
      .on('CHANGE_GM_MODE', event => {
        this.changeDetector.markForCheck();
      })
      .on('POPUP_CHAT_BALLOON', -1000, event => {
        if (this.gameCharacter && this.gameCharacter.identifier == event.data.characterIdentifier) {
          this.ngZone.run(() => {
            this.dialog = event.data;
            this.changeDetector.markForCheck();
          });
        }
      })
      .on('FAREWELL_CHAT_BALLOON', -1000, event => {
        if (this.gameCharacter && this.gameCharacter.identifier == event.data.characterIdentifier) {
          this.ngZone.run(() => {
            this._dialog = null;
            this.gameCharacter.text = '';
            this.gameCharacter.isEmote = false;
            this.changeDetector.markForCheck();
          });
          clearTimeout(this.dialogTimeOutId);
          clearInterval(this.chatIntervalId);
        }
      })
      ;
      
    this.movableOption = {
      tabletopObject: this.gameCharacter,
      transformCssOffset: 'translateZ(1.0px)',
      colideLayers: ['terrain', 'text-note', 'character']
    };
    this.rotableOption = {
      tabletopObject: this.gameCharacter
    };
  }

  ngAfterViewInit() {
    queueMicrotask(() => {
      this.gameCharacter.isLoaded = true;
    });
  }

  ngOnDestroy() {
    clearTimeout(this.dialogTimeOutId);
    clearInterval(this.chatIntervalId);
    if (this.gameCharacter) {
      this.gameCharacter.text = '';
      this.gameCharacter.isEmote = false;
    }
    EventSystem.unregister(this);
  }

  @HostListener('dragstart', ['$event'])
  onDragstart(e: any) {
    console.log('Dragstart Cancel !!!!');
    e.stopPropagation();
    e.preventDefault();
  }

  @HostListener('contextmenu', ['$event'])
  onContextMenu(e: Event) {
    e.stopPropagation();
    e.preventDefault();

    if (!this.pointerDeviceService.isAllowedToOpenContextMenu) return;

    let position = this.pointerDeviceService.pointers[0];
    this.contextMenuService.open(position, [
      { 
        name: this.isHideIn ? '위치를 공개한다' : '위치를 자신만 본다(스텔스)',
        action: () => {
          if (this.isHideIn) {
            this.gameCharacter.owner = '';
            SoundEffect.play(PresetSound.piecePut);
          } else {
            if (!GameCharacter.isStealthMode && !PeerCursor.myCursor.isGMMode) {
              this.modalService.open(ConfirmationComponent, {
                title: '스텔스모드', 
                text: '스텔스모드가 됩니다.',
                help: '위치를 자신만 보고 있는 캐릭터가 1개 이상 테이블 위에 있는 동안, 당신의 커서 위치는 다른 참가자에게 전달되지 않습니다.',
                type: ConfirmationType.OK,
                materialIcon: 'disabled_visible'
              });
            }
            this.gameCharacter.owner = Network.peerContext.userId;
            SoundEffect.play(PresetSound.sweep);
            EventSystem.call('FAREWELL_STAND_IMAGE', { characterIdentifier: this.gameCharacter.identifier });
          }
          EventSystem.call('UPDATE_INVENTORY', true);
        },
      },
      ContextMenuSeparator,
      (this.gameCharacter.imageFiles.length <= 1 ? null : {
        name: '이미지 변경',
        action: null,
        subActions: this.gameCharacter.imageFiles.map((image, i) => {
          return { 
            name: `${this.gameCharacter.currntImageIndex == i ? '◉' : '○'}`, 
            action: () => { this.changeImage(i); }, 
            default: this.gameCharacter.currntImageIndex == i,
            icon: image
          };
        })
      }),
      (this.gameCharacter.imageFiles.length <= 1 ? null : ContextMenuSeparator),
      (this.isUseIconToOverviewImage
        ? {
          name: '☑ 오버뷰에 얼굴 아이콘을 사용', action: () => {
            this.isUseIconToOverviewImage = false;
            EventSystem.trigger('UPDATE_INVENTORY', null);
          }
        } : {
          name: '☐ 오버뷰에 얼굴 아이콘을 사용', action: () => {
            this.isUseIconToOverviewImage = true;
            EventSystem.trigger('UPDATE_INVENTORY', null);
          }
        }),
      (this.gameCharacter.isShowChatBubble
        ? {
          name: '☑ 💭의 표시', action: () => {
            this.gameCharacter.isShowChatBubble = false;
            EventSystem.trigger('UPDATE_INVENTORY', null);
          }
        } : {
          name: '☐ 💭의 표시', action: () => {
            this.gameCharacter.isShowChatBubble = true;
            EventSystem.trigger('UPDATE_INVENTORY', null);
          }
        }),
      (this.isDropShadow
        ? {
          name: '☑ 그림자의 표시', action: () => {
            this.isDropShadow = false;
            EventSystem.trigger('UPDATE_INVENTORY', null);
          }
        } : {
          name: '☐ 그림자의 표시', action: () => {
            this.isDropShadow = true;
            EventSystem.trigger('UPDATE_INVENTORY', null);
          }
        }),
      { name: '이미지 효과', action: null, subActions: [
        (this.isInverse
          ? {
            name: '☑ 반전', action: () => {
              this.isInverse = false;
              EventSystem.trigger('UPDATE_INVENTORY', null);
            }
          } : {
            name: '☐ 반전', action: () => {
              this.isInverse = true;
              EventSystem.trigger('UPDATE_INVENTORY', null);
            }
          }),
        (this.isHollow
          ? {
            name: '☑ 흐리게', action: () => {
              this.isHollow = false;
              EventSystem.trigger('UPDATE_INVENTORY', null);
            }
          } : {
            name: '☐ 흐리게', action: () => {
              this.isHollow = true;
              EventSystem.trigger('UPDATE_INVENTORY', null);
            }
          }),
        (this.isBlackPaint
          ? {
            name: '☑ 검은칠', action: () => {
              this.isBlackPaint = false;
              EventSystem.trigger('UPDATE_INVENTORY', null);
            }
          } : {
            name: '☐ 검은칠', action: () => {
              this.isBlackPaint = true;
              EventSystem.trigger('UPDATE_INVENTORY', null);
            }
          }),
          { name: '오오라', action: null, subActions: [{ name: `${this.aura == -1 ? '◉' : '○'} 없음`, action: () => { this.aura = -1; EventSystem.trigger('UPDATE_INVENTORY', null) } }, ContextMenuSeparator].concat(['블랙', '블루', '그린', '시안', '레드', '마젠타', '옐로', '화이트'].map((color, i) => {  
            return { name: `${this.aura == i ? '◉' : '○'} ${color}`, action: () => { this.aura = i; EventSystem.trigger('UPDATE_INVENTORY', null) } };
          })) },
          ContextMenuSeparator,
          {
            name: '리셋', action: () => {
              this.isInverse = false;
              this.isHollow = false;
              this.isBlackPaint = false;
              this.aura = -1;
              EventSystem.trigger('UPDATE_INVENTORY', null);
            },
            disabled: !this.isInverse && !this.isHollow && !this.isBlackPaint && this.aura == -1
          }
        ]
      },
      ContextMenuSeparator,
      (!this.isNotRide
        ? {
          name: '☑ 다른 캐릭터에 올린다', action: () => {
            this.isNotRide = true;
            EventSystem.trigger('UPDATE_INVENTORY', null);
          }
        } : {
          name: '☐ 다른 캐릭터에 올린다', action: () => {
            this.isNotRide = false;
            EventSystem.trigger('UPDATE_INVENTORY', null);
          }
        }),
      (this.isAltitudeIndicate
        ? {
          name: '☑ 고도의 표시', action: () => {
            this.isAltitudeIndicate = false;
            EventSystem.trigger('UPDATE_INVENTORY', null);
          }
        } : {
          name: '☐ 고도의 표시', action: () => {
            this.isAltitudeIndicate = true;
            EventSystem.trigger('UPDATE_INVENTORY', null);
          }
        }),
      {
        name: '고도를 0으로 한다', action: () => {
          if (this.altitude != 0) {
            this.altitude = 0;
            if (!this.isHideIn) SoundEffect.play(PresetSound.sweep);
          }
        },
        altitudeHande: this.gameCharacter
      },
      ContextMenuSeparator,
      { name: '상세를 표시', action: () => { this.showDetail(this.gameCharacter); } },
      { name: '채팅 팔레트를 표시', action: () => { this.showChatPalette(this.gameCharacter) } },
      { name: '스탠딩 설정', action: () => { this.showStandSetting(this.gameCharacter) } },
      ContextMenuSeparator,
      {
        name: '참조URL을 연다', action: null,
        subActions: this.gameCharacter.getUrls().map((urlElement) => {
          const url = urlElement.value.toString();
          return {
            name: urlElement.name ? urlElement.name : url,
            action: () => {
              if (StringUtil.sameOrigin(url)) {
                window.open(url.trim(), '_blank', 'noopener');
              } else {
                this.modalService.open(OpenUrlComponent, { url: url, title: this.gameCharacter.name, subTitle: urlElement.name });
              } 
            },
            disabled: !StringUtil.validUrl(url),
            error: !StringUtil.validUrl(url) ? 'URL이 정확하지 않습니다' : null,
            isOuterLink: StringUtil.validUrl(url) && !StringUtil.sameOrigin(url)
          };
        }),
        disabled: this.gameCharacter.getUrls().length <= 0
      },
      ContextMenuSeparator,
      (this.gameCharacter.isInventoryIndicate
        ? {
          name: '☑ 테이블 인벤토리에 표시', action: () => {
            this.gameCharacter.isInventoryIndicate = false;
            EventSystem.trigger('UPDATE_INVENTORY', null);
          }
        } : {
          name: '☐ 테이블 인벤토리에 표시', action: () => {
            this.gameCharacter.isInventoryIndicate = true;
            EventSystem.trigger('UPDATE_INVENTORY', null);
          }
        }),
      { name: '테이블로부터 이동', action: null, subActions: [
        {
          name: '공유 인벤토리', action: () => {
            EventSystem.call('FAREWELL_STAND_IMAGE', { characterIdentifier: this.gameCharacter.identifier });
            this.gameCharacter.setLocation('common');
            SoundEffect.play(PresetSound.piecePut);
          }
        },
        {
          name: '개인 인벤토리', action: () => {
            EventSystem.call('FAREWELL_STAND_IMAGE', { characterIdentifier: this.gameCharacter.identifier });
            this.gameCharacter.setLocation(Network.peerId);
            SoundEffect.play(PresetSound.piecePut);
          }
        },
        {
          name: '묘지', action: () => {
            EventSystem.call('FAREWELL_STAND_IMAGE', { characterIdentifier: this.gameCharacter.identifier });
            this.gameCharacter.setLocation('graveyard');
            SoundEffect.play(PresetSound.sweep);
          }
        },
      ]},
      ContextMenuSeparator,
      {
        name: '사본을 작성', action: () => {
          let cloneObject = this.gameCharacter.clone();
          cloneObject.location.x += this.gridSize;
          cloneObject.location.y += this.gridSize;
          cloneObject.update();
          SoundEffect.play(PresetSound.piecePut);
        }
      },
      {
        name: '사본을 작성(자동번호생성)', action: () => {
          const cloneObject = this.gameCharacter.clone();
          const tmp = cloneObject.name.split('_');
          let baseName;
          if (tmp.length > 1 && /\d+/.test(tmp[tmp.length - 1])) {
            baseName = tmp.slice(0, tmp.length - 1).join('_');
          } else {
            baseName = tmp.join('_');
          }
          let maxIndex = 0;
          for (const character of ObjectStore.instance.getObjects(GameCharacter)) {
            if(!character.name.startsWith(baseName)) continue;
            let index = character.name.match(/_(\d+)$/) ? +RegExp.$1 : 0;
            if (index > maxIndex) maxIndex = index;
          }
          cloneObject.name = baseName + '_' + (maxIndex + 1);
          cloneObject.location.x += this.gridSize;
          cloneObject.location.y += this.gridSize;
          cloneObject.update();
          SoundEffect.play(PresetSound.piecePut);
        }
      },
      ContextMenuSeparator,
      {
        name: '삭제(묘지에 이동)', action: () => {
          EventSystem.call('FAREWELL_STAND_IMAGE', { characterIdentifier: this.gameCharacter.identifier });
          this.gameCharacter.setLocation('graveyard');
          SoundEffect.play(PresetSound.sweep);
        }
      }
    ], this.name);
  }

  onMove() {
    if (!this.isHideIn) SoundEffect.play(PresetSound.piecePick);
  }

  onMoved() {
    // とりあえず移動したら💭消す
    if (this.gameCharacter && this.gameCharacter.text) {
      EventSystem.call('FAREWELL_CHAT_BALLOON', { characterIdentifier: this.gameCharacter.identifier });
    }
    if (!this.isHideIn) SoundEffect.play(PresetSound.piecePut);
    this.selected = false;
  }

  onImageLoad() {
    this.naturalImageWidth = this.characterImage.nativeElement.naturalWidth;
    this.naturalImageHeight = this.characterImage.nativeElement.naturalHeight;
    this.naturaHeightWidthRatio =  (this.naturalImageWidth && this.naturalImageHeight) ? (this.naturalImageHeight / this.naturalImageWidth) : 1;
    EventSystem.trigger('UPDATE_GAME_OBJECT', this.gameCharacter);
  }

  private adjustMinBounds(value: number, min: number = 0): number {
    return value < min ? min : value;
  }

  private showDetail(gameObject: GameCharacter) {
    let coordinate = this.pointerDeviceService.pointers[0];
    let title = '캐릭터 시트';
    if (gameObject.name.length) title += ' - ' + gameObject.name;
    let option: PanelOption = { title: title, left: coordinate.x - 400, top: coordinate.y - 300, width: 800, height: 600 };
    let component = this.panelService.open<GameCharacterSheetComponent>(GameCharacterSheetComponent, option);
    component.tabletopObject = gameObject;
  }

  private showChatPalette(gameObject: GameCharacter) {
    let coordinate = this.pointerDeviceService.pointers[0];
    let option: PanelOption = { left: coordinate.x - 250, top: coordinate.y - 175, width: 620, height: 350 };
    let component = this.panelService.open<ChatPaletteComponent>(ChatPaletteComponent, option);
    component.character = gameObject;
  }

  private showStandSetting(gameObject: GameCharacter) {
    let coordinate = this.pointerDeviceService.pointers[0];
    let option: PanelOption = { left: coordinate.x - 400, top: coordinate.y - 175, width: 730, height: 572 };
    let component = this.panelService.open<StandSettingComponent>(StandSettingComponent, option);
    component.character = gameObject;
  }

  changeImage(index: number) {
    if (this.gameCharacter.currntImageIndex != index) {
      this.gameCharacter.currntImageIndex = index;
      if (!this.isHideIn) SoundEffect.play(PresetSound.surprise);
      EventSystem.call('FAREWELL_STAND_IMAGE', { characterIdentifier: this.gameCharacter.identifier });
      EventSystem.trigger('UPDATE_INVENTORY', null);
    }
  }

  nextImage() {
    if (this.gameCharacter.imageFiles.length <= 1) return;
    if (this.gameCharacter.currntImageIndex + 1 >= this.gameCharacter.imageFiles.length) {
      this.changeImage(0);
    } else {
      this.changeImage(this.gameCharacter.currntImageIndex + 1);
    }
  }
}
