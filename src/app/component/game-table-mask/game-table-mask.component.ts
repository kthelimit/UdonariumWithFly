import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Input,
  NgZone,
  OnChanges,
  OnDestroy
} from '@angular/core';
import { ImageFile, ImageState } from '@udonarium/core/file-storage/image-file';
import { EventSystem, Network } from '@udonarium/core/system';
import { StringUtil } from '@udonarium/core/system/util/string-util';
import { MathUtil } from '@udonarium/core/system/util/math-util';
import { GameTableMask } from '@udonarium/game-table-mask';
import { PresetSound, SoundEffect } from '@udonarium/sound-effect';
import { GameCharacterSheetComponent } from 'component/game-character-sheet/game-character-sheet.component';
import { OpenUrlComponent } from 'component/open-url/open-url.component';
import { InputHandler } from 'directive/input-handler';
import { MovableOption } from 'directive/movable.directive';
import { ModalService } from 'service/modal.service';
import { ContextMenuAction, ContextMenuSeparator, ContextMenuService } from 'service/context-menu.service';
import { CoordinateService } from 'service/coordinate.service';
import { PanelOption, PanelService } from 'service/panel.service';
import { PointerDeviceService } from 'service/pointer-device.service';
import { TabletopActionService } from 'service/tabletop-action.service';
import { UUID } from '@udonarium/core/system/util/uuid';
import { animate, keyframes, style, transition, trigger } from '@angular/animations';
import { TableSelecter } from '@udonarium/table-selecter';
import { ConfirmationComponent, ConfirmationType } from 'component/confirmation/confirmation.component';
import { ChatMessageService } from 'service/chat-message.service';
import { PeerCursor } from '@udonarium/peer-cursor';
import { xor } from 'lodash';
import { SelectionState, TabletopSelectionService } from 'service/tabletop-selection.service';

@Component({
  selector: 'game-table-mask',
  templateUrl: './game-table-mask.component.html',
  styleUrls: ['./game-table-mask.component.css'],
  animations: [
    trigger('fadeInOut', [
      transition('void => *', [
        animate('132ms ease-out', keyframes([
          style({ opacity: 0, offset: 0 }),
          style({ opacity: 1, offset: 1.0 })
        ]))
      ]),
      transition('* => void', [
        animate('132ms ease-in', keyframes([
          style({ opacity: 1, offset: 0 }),
          style({ opacity: 0, offset: 1.0 })
        ]))
      ])
    ]),
    trigger('rotateInOut', [
      transition('scrached<=>restore', [
        animate('132ms ease-in-out', keyframes([
          style({ transform: 'rotateY(0deg)', offset: 0.0 }),
          style({ transform: 'rotateY(-90deg)', offset: 1.0 })
        ]))
      ])
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GameTableMaskComponent implements OnChanges, OnDestroy, AfterViewInit {
  @Input() gameTableMask: GameTableMask = null;
  @Input() is3D: boolean = false;

  get name(): string { return this.gameTableMask.name; }
  get width(): number { return MathUtil.clampMin(this.gameTableMask.width); }
  get height(): number { return MathUtil.clampMin(this.gameTableMask.height); }
  get opacity(): number { return this.gameTableMask.opacity; }
  get imageFile(): ImageFile { return this.gameTableMask.imageFile; }
  get isLock(): boolean { return this.gameTableMask.isLock; }
  set isLock(isLock: boolean) { this.gameTableMask.isLock = isLock; }
  get blendType(): number { return this.gameTableMask.blendType; }
  set blendType(blendType: number) { this.gameTableMask.blendType = blendType; }
  get borderType(): number { return this.gameTableMask.borderType; }
  set borderType(borderType: number) { this.gameTableMask.borderType = borderType; }

  get fontSize(): number { return this.gameTableMask.fontsize; }
  set fontSize(fontSize: number) { this.gameTableMask.fontsize = fontSize; }
  get text(): string { return this.gameTableMask.text; }
  set text(text: string) { this.gameTableMask.text = text; }
  get color(): string { return this.gameTableMask.color; }
  set color(color: string) { this.gameTableMask.color = color; }
  get bgcolor(): string { return this.gameTableMask.bgcolor; }
  set bgcolor(bgcolor: string) { this.gameTableMask.bgcolor = bgcolor; }

  get isPreview(): boolean { return this.gameTableMask.isPreview; }
  set isPreview(isPreview: boolean) { this.gameTableMask.isPreview = isPreview; }
  get isPreviewMode(): boolean {
    if (!this.gameTableMask) return false;
    return this.isGMMode && this.gameTableMask.isScratchPreviewOnGMMode
     || this.isPreview && this.gameTableMask.isMine;
  }

  get textShadowCss(): string {
    const shadow = StringUtil.textShadowColor(this.color);
    return `${shadow} 0px 0px 2px, 
      ${shadow} 0px 0px 2px, 
      ${shadow} 0px 0px 2px, 
      ${shadow} 0px 0px 2px, 
      ${shadow} 0px 0px 2px, 
      ${shadow} 0px 0px 2px,
      ${shadow} 0px 0px 2px,
      ${shadow} 0px 0px 2px`;
  }

  get scratchedGrids() {
    return this.gameTableMask.scratchedGrids;
  }
  set scratchedGrids(scratchedGrids: string) {
    this.gameTableMask.scratchedGrids = scratchedGrids;
  }

  get scratchingGrids() {
    return this.gameTableMask.scratchingGrids;
  }
  set scratchingGrids(scratchingGrids: string) {
    this.gameTableMask.scratchingGrids = scratchingGrids;
  }

  get isNonScratched(): boolean {
    return !this.gameTableMask.scratchedGrids;
  }

  get isNonScratching(): boolean {
    return !(this.gameTableMask.scratchingGrids || this._currentScratchingSet);
  }

  get masksCss(): string {
    if (!this.isPreviewMode && this.isNonScratched) return '';
    const masks: string[] = [];
    const scratchedSet: Set<string> = new Set(this.scratchedGrids.split(/,/g));
    const scratchingSet: Set<string> = this._currentScratchingSet ? this._currentScratchingSet : new Set(this.scratchingGrids.split(/,/g));
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        const gridStr = `${x}:${y}`;
        if (this.isPreviewMode) {
          if (scratchedSet.has(gridStr) && !scratchingSet.has(gridStr)) continue;
          if (scratchingSet.has(gridStr) && !scratchedSet.has(gridStr)) continue;
        } else {
          if (scratchedSet.has(gridStr)) continue;
        }
        masks.push(`radial-gradient(#000, #000) ${ x * this.gridSize - 1 }px ${ y * this.gridSize -1 }px / ${ this.gridSize + 2 }px ${ this.gridSize + 2 }px no-repeat`);
      }
    }
    return masks.length ? masks.join(',') : 'radial-gradient(#000, #000) 0px 0px / 0px 0px no-repeat';
  }
  
  get scratchingGridInfos(): {x: number, y: number, state: string}[] {
    const ret: {x: number, y: number, state: string}[] = [];
    if (!this.gameTableMask || (this.isNonScratching && this.isNonScratched)) return ret;
    const scratchingGridSet: Set<string> = this._currentScratchingSet ? this._currentScratchingSet : new Set(this.scratchingGrids.split(/,/g));
    const scratchedGridSet: Set<string> = new Set(this.scratchedGrids.split(/,/g));
    for (let x = 0; x < Math.ceil(this.width); x++) {
      for (let y = 0; y < Math.ceil(this.height); y++) {
        const gridStr = `${x}:${y}`;
        if (scratchingGridSet.has(gridStr) || scratchedGridSet.has(gridStr)) ret.push({ 
          x: x, 
          y: y, 
          state: !scratchingGridSet.has(gridStr) ? 'scrached' : 
            !scratchedGridSet.has(gridStr) ? 'scraching' 
            : 'restore'
        });
      }
    }
    return ret;
  }

  get operateOpacity(): number {
    const ret = this.opacity * ((this.isGMMode && this.gameTableMask.isTransparentOnGMMode) || (this.isPreview && this.gameTableMask.isMine) ? 0.6 : 1);
    return (ret < 0.4 && this.isScratching) ? 0.4 : ret;
  }

  get altitude(): number { return this.gameTableMask.altitude; }
  set altitude(altitude: number) { this.gameTableMask.altitude = altitude; }

  get isAltitudeIndicate(): boolean { return this.gameTableMask.isAltitudeIndicate; }
  set isAltitudeIndicate(isAltitudeIndicate: boolean) { this.gameTableMask.isAltitudeIndicate = isAltitudeIndicate; }

  get gameTableMaskAltitude(): number {
    return +this.altitude.toFixed(1); 
  }
  
  get rubiedText(): string {
    return StringUtil.rubyToHtml(StringUtil.escapeHtml(this.text));
  }

  get isInverse(): boolean {
    return 90 < Math.abs(this.viewRotateZ) % 360 && Math.abs(this.viewRotateZ) % 360 < 270
  }

  get isGMMode(): boolean { return this.gameTableMask.isGMMode; }
  get isScratching(): boolean { return !!this.gameTableMask.owner; }

  get hasOwner(): boolean { return this.gameTableMask.hasOwner; }
  get ownerIsOnline(): boolean { return this.gameTableMask.ownerIsOnline; }
  get ownerName(): string { return this.gameTableMask.ownerName; }
  get ownerColor(): string { return this.gameTableMask.ownerColor; }

  panelId;
  
  get selectionState(): SelectionState { return this.selectionService.state(this.gameTableMask); }
  get isSelected(): boolean { return this.selectionState !== SelectionState.NONE; }
  get isMagnetic(): boolean { return this.selectionState === SelectionState.MAGNETIC; }

  gridSize: number = 50;
  math = Math;
  viewRotateZ = 10;

  movableOption: MovableOption = {};

  private input: InputHandler = null;
  
  private _currentimageFile: ImageFile;
  private _currentImageFileUrl: string = '';
  private _currentImageFileState = 0;
  get imageFileUrl(): string {
    let revokeUrl = '';
    if (this.imageFile && (this.imageFile.identifier != this._currentimageFile?.identifier || this.imageFile.state != this._currentImageFileState)) {
      this._currentimageFile = this.imageFile;
      if (this._currentimageFile.state === ImageState.THUMBNAIL || this._currentimageFile.state === ImageState.COMPLETE) {
        this._currentImageFileState = this._currentimageFile.state;
        if (this._currentImageFileUrl) revokeUrl = this._currentImageFileUrl;
        this._currentImageFileUrl = URL.createObjectURL(this._currentimageFile.blob);
      } else {
        this._currentImageFileUrl = this._currentimageFile.url;
      }
    }
    if (revokeUrl) queueMicrotask(() => URL.revokeObjectURL(revokeUrl));
    return this._currentImageFileUrl;
  }


  constructor(
    private ngZone: NgZone,
    private tabletopActionService: TabletopActionService,
    private contextMenuService: ContextMenuService,
    private elementRef: ElementRef<HTMLElement>,
    private panelService: PanelService,
    private changeDetector: ChangeDetectorRef,
    private selectionService: TabletopSelectionService,
    private pointerDeviceService: PointerDeviceService,
    private modalService: ModalService,
    private coordinateService: CoordinateService,
    private chatMessageService: ChatMessageService
  ) { }

  ngOnChanges(): void {
    EventSystem.unregister(this);
    EventSystem.register(this)
      .on(`UPDATE_GAME_OBJECT/identifier/${this.gameTableMask?.identifier}`, event => {
        this.changeDetector.markForCheck();
      })
      .on(`UPDATE_OBJECT_CHILDREN/identifier/${this.gameTableMask?.identifier}`, event => {
        this.changeDetector.markForCheck();
      })
      .on('CHANGE_GM_MODE', event => {
        this.changeDetector.markForCheck();
      })
      .on('SYNCHRONIZE_FILE_LIST', event => {
        this.changeDetector.markForCheck();
      })
      .on('UPDATE_FILE_RESOURE', event => {
        this.changeDetector.markForCheck();
      })
      .on<object>('TABLE_VIEW_ROTATE', -1000, event => {
        this.ngZone.run(() => {
          this.viewRotateZ = event.data['z'];
          this.changeDetector.markForCheck();
        });
      })
      .on(`UPDATE_SELECTION/identifier/${this.gameTableMask?.identifier}`, event => {
        this.changeDetector.markForCheck();
      });
    this.movableOption = {
      tabletopObject: this.gameTableMask,
      transformCssOffset: 'translateZ(0.10px)',
      colideLayers: ['terrain']
    };
    this.panelId = UUID.generateUuid();
  }

  ngAfterViewInit() {
    this.ngZone.runOutsideAngular(() => {
      this.input = new InputHandler(this.elementRef.nativeElement);
    });
    this.input.onStart = this.onInputStart.bind(this);
    this.input.onMove = this.onInputMove.bind(this);
  }

  ngOnDestroy() {
    this.input.destroy();
    EventSystem.unregister(this);
    clearTimeout(this._scratchingTimerId);
    if (this._currentImageFileUrl) URL.revokeObjectURL(this._currentImageFileUrl);
  }

  @HostListener('dragstart', ['$event'])
  onDragstart(e) {
    e.stopPropagation();
    e.preventDefault();
  }

  onInputStart(e: any) {
    if (!this.isScratching || !this.gameTableMask.isMine) { 
      this.input.cancel();
    } else if (!window.PointerEvent && e.button < 2 && e.buttons < 2) {
      this.scratching(true);
    }
    //console.log(e)
    // TODO:もっと良い方法考える
    if ((this.isLock && !this.isScratching) || (this.isScratching && !this.gameTableMask.isMine)) {
      EventSystem.trigger('DRAG_LOCKED_OBJECT', { srcEvent: e });
    }
  }

  @HostListener('pointerdown', ['$event'])
  onInputStartPointer(e: PointerEvent) {
    if (!this.isScratching || !this.gameTableMask.isMine) { 
      //this.input.cancel();
    } else if (e.button < 2 && e.buttons < 2) {
      this.scratching(true, {offsetX: e.offsetX, offsetY: e.offsetY});
    }
  }

  private _scratchingGridX = -1;
  private _scratchingGridY = -1;
  onInputMove(e: any) {
    if (!window.PointerEvent && this.isScratching && this.gameTableMask.isMine && this.input.isDragging) {
      this.scratching(false);
    }
  }

  @HostListener('pointermove', ['$event'])
  onInputMovePointer(e: PointerEvent) {
    if (this.isScratching && this.gameTableMask.isMine && this.input.isDragging && e.buttons < 2) {
      this.scratching(false, {offsetX: e.offsetX, offsetY: e.offsetY});
    }
  }

  private _currentScratchingSet: Set<string>;
  private _scratchingTimerId;
  scratching(isStart: boolean, position: {offsetX: number, offsetY: number} = null) {
    if (!this.gameTableMask.isMine) return;
    // とりあえず、本当は周辺を表示したい。
    const tableSelecter = TableSelecter.instance;
    if (!tableSelecter.gridShow) tableSelecter.viewTable.gridClipRect = {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      };
    //viewTable.gridHeight = this.gameTableMask.posZ + this.gameTableMask.altitude * this.gridSize + 0.5;
    let offsetX
    let offsetY;
    if (position) {
      offsetX = position.offsetX;
      offsetY = position.offsetY;
    } else {
      const scratchingPosition = this.coordinateService.calcTabletopLocalCoordinate(this.pointerDeviceService.pointers[0], this.elementRef.nativeElement);
      offsetX = scratchingPosition.x - this.gameTableMask.location.x;
      offsetY = scratchingPosition.y - this.gameTableMask.location.y;
    }
    if (offsetX < 0 || this.gameTableMask.width * this.gridSize <= offsetX || offsetY < 0 || this.gameTableMask.height * this.gridSize <= offsetY) return;
    const gridX = Math.floor(offsetX / this.gridSize);
    const gridY = Math.floor(offsetY / this.gridSize);

    if (!isStart && this._scratchingGridX === gridX && this._scratchingGridY === gridY) return;
    const tempScratching = `${gridX}:${gridY}`;
    this._scratchingGridX = gridX;
    this._scratchingGridY = gridY;
    if (!this._currentScratchingSet) this._currentScratchingSet = new Set(this.scratchingGrids.split(/,/g));
    if (this._currentScratchingSet.has(tempScratching)) {
      this._currentScratchingSet.delete(tempScratching);
    } else {
      this._currentScratchingSet.add(tempScratching);
    }
    clearTimeout(this._scratchingTimerId);
    this._scratchingTimerId = setTimeout(() => {
      this.scratchingGrids = Array.from(this._currentScratchingSet).filter(grid => grid && /^\d+:\d+$/.test(grid)).sort().join(',');
      this._currentScratchingSet = null;
    }, 250);
  }

  scratched() {
    const currentScratchedAry: string[] = this.scratchedGrids.split(/,/g);
    if (this._currentScratchingSet) {
      clearTimeout(this._scratchingTimerId);
      this.scratchingGrids = Array.from(this._currentScratchingSet).filter(grid => grid && /^\d+:\d+$/.test(grid)).sort().join(',');
      this._currentScratchingSet = null;
    }
    const currentScratchingAry: string[] = this.scratchingGrids.split(/,/g);
    this.scratchedGrids = xor(currentScratchedAry, currentScratchingAry).filter(grid => grid && /^\d+:\d+$/.test(grid)).sort().join(',');
  }

  @HostListener('contextmenu', ['$event'])
  onContextMenu(e: Event) {
    e.stopPropagation();
    e.preventDefault();

    if (!this.pointerDeviceService.isAllowedToOpenContextMenu) return;
    let menuPosition = this.pointerDeviceService.pointers[0];

    let menuActions: ContextMenuAction[] = [];
    menuActions = menuActions.concat(this.makeSelectionContextMenu());
    menuActions = menuActions.concat(this.makeContextMenu());

    this.contextMenuService.open(menuPosition, menuActions, this.name);
  }

  onMove() {
    this.contextMenuService.close();
    SoundEffect.play(PresetSound.cardPick);
  }

  onMoved() {
    SoundEffect.play(PresetSound.cardPut);
  }

  scratchDone(e: Event=null) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!this.gameTableMask.isMine) return false;
    this.ngZone.run(() => {
      this.scratched();
      this.gameTableMask.owner = '';
      this.scratchingGrids = '';
      this.isPreview = false;
    });
    this._scratchingGridX = -1;
    this._scratchingGridY = -1;
    SoundEffect.play(PresetSound.cardPut);
    this.chatMessageService.sendOperationLog(`${ this.gameTableMask.name == '' ? '(이름 없는 맵 마스크)' : this.gameTableMask.name }의 스크래치를 종료했다`);
    return false;
  }

  scratchCancel(e: Event=null) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!this.gameTableMask.isMine && this.ownerIsOnline) return false;
    this.ngZone.run(() => {
      this.gameTableMask.owner = '';
      this.scratchingGrids = '';
      this.isPreview = false;
    });
    this._scratchingGridX = -1;
    this._scratchingGridY = -1;
    SoundEffect.play(PresetSound.unlock);
    this.chatMessageService.sendOperationLog(`${ this.gameTableMask.name == '' ? '(이름 없는 맵 마스크)' : this.gameTableMask.name }의 스크래치를 종료했다`);
    return false;
  }

  prevent(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  private makeSelectionContextMenu(): ContextMenuAction[] {
    if (this.selectionService.objects.length < 1) return [];

    let actions: ContextMenuAction[] = [];

    let objectPosition = this.coordinateService.calcTabletopLocalCoordinate();
    actions.push({ name: '여기에 모은다', action: () => this.selectionService.congregate(objectPosition) });

    if (this.isSelected) {
      let selectedGameTableMasks = () => this.selectionService.objects.filter(object => object.aliasName === this.gameTableMask.aliasName) as GameTableMask[];
      actions.push(
        {
          name: '선택한 맵 마스크', action: null, subActions: [
            {
              name: '전부 고정한다', action: () => {
                selectedGameTableMasks().forEach(gameTableMask => gameTableMask.isLock = true);
                SoundEffect.play(PresetSound.lock);
              }
            },
            {
              name: '전체의 사본을 작성', action: () => {
                selectedGameTableMasks().forEach(gameTableMask => {
                  let cloneObject = gameTableMask.clone();
                  cloneObject.location.x += this.gridSize;
                  cloneObject.location.y += this.gridSize;
                  cloneObject.isLock = false;
                  if (gameTableMask.parent) gameTableMask.parent.appendChild(cloneObject);
                });
                SoundEffect.play(PresetSound.cardPut);
              }
            },
          ]
        }
      );
    }
    actions.push(ContextMenuSeparator);
    return actions;
  }

  private makeContextMenu(): ContextMenuAction[] {
    let objectPosition = this.coordinateService.calcTabletopLocalCoordinate();
    let actions: ContextMenuAction[] = [
      (this.isGMMode ?
        this.gameTableMask.isTransparentOnGMMode ? {
          name: '☑ GM시 투과 표시', action: () => {
            this.gameTableMask.isTransparentOnGMMode = false;
          },
          checkBox: 'check'
        }
        : {
          name: '☐ GM시 투과 표시', action: () => {
            this.gameTableMask.isTransparentOnGMMode = true;
          },
          checkBox: 'check'
        }
      : null),
      (this.isGMMode ?
        this.gameTableMask.isScratchPreviewOnGMMode ? {
          name: '☑ GM시 스크래치 프리뷰', action: () => {
            this.gameTableMask.isScratchPreviewOnGMMode = false;
          },
          checkBox: 'check'
        }
        : {
          name: '☐ GM시 스크래치 프리뷰', action: () => {
            this.gameTableMask.isScratchPreviewOnGMMode = true;
          },
          checkBox: 'check'
        }
      : null),
      (this.isGMMode ? ContextMenuSeparator : null),
      (this.isLock
        ? {
          name: '☑ 고정', action: () => {
            this.isLock = false;
            //this.chatMessageService.sendOperationLog(`${this.gameTableMask.name} 의 고정을 해제했다`);
            SoundEffect.play(PresetSound.unlock);
          },
          disabled: this.isScratching,
          checkBox: 'check'
        }
        : {
          name: '☐ 고정', action: () => {
            this.isLock = true;
            SoundEffect.play(PresetSound.lock);
          },
          disabled: this.isScratching,
          checkBox: 'check'
        }
      ),
      (this.isLock ? null : { name: '겹치기 순서', action: null, subActions: [
        {
          name: '맵 마스크의 가장 위에', action: () => {
            if (!this.isLock) {
              const parent = this.gameTableMask.parent;
              if (parent) parent.appendChild(this.gameTableMask);
            }
          },
          disabled: this.isLock
        },
        {
          name: '맵 마스크의 가장 아래에', action: () => {
            if (!this.isLock) {
              const parent = this.gameTableMask.parent;
              if (parent) parent.prependChild(this.gameTableMask);
            }
          },
          disabled: this.isLock
        }],
        disabled: this.isLock
      }),
      ContextMenuSeparator,
      (!this.gameTableMask.isMine ?
        {
          name: '스크래치 개시', action: () => { 
            let isHandover = false;
            if (this.gameTableMask.owner != '') {
              this.isPreview = false;
              clearTimeout(this._scratchingTimerId);
              this._currentScratchingSet = null;
              const owner = PeerCursor.findByUserId(this.gameTableMask.owner);
              if (owner) {
                this.chatMessageService.sendOperationLog(`${ this.gameTableMask.name == '' ? '(이름 없는 맵 마스크)' : this.gameTableMask.name } 의 스크래치를 ${ owner.name == '' ? '(이름 없는 플레이어)' : owner.name } 로부터 이어받았다`);
                isHandover = true;
              }
            }
            this.gameTableMask.owner = Network.peer.userId;
            this._scratchingGridX = -1;
            this._scratchingGridY = -1;
            SoundEffect.play(PresetSound.lock);
            if (!isHandover) this.chatMessageService.sendOperationLog(`${ this.gameTableMask.name == '' ? '(이름 없는 맵 마스크)' : this.gameTableMask.name } 의 스크래치를 개시했다`);
          },
        } : {
          name: `스크래치${ this.isNonScratching ? '종료' : '확정' }`, action: () => { this.scratchDone(); },
        }
      ),
      {
        name: '스크래치 취소', action: () => { this.scratchCancel(); },
        disabled: !this.isScratching || (!this.gameTableMask.isMine && this.ownerIsOnline)
      },
      {
        name: '스크래치 조작',
        subActions: [
          { 
            name: '적용하고 계속한다', action: () => {
              if (!this.gameTableMask.isMine) return;
              this.ngZone.run(() => {
                this.scratched();
                this.scratchingGrids = '';
              });
              this._scratchingGridX = -1;
              this._scratchingGridY = -1;
              SoundEffect.play(PresetSound.cardDraw);
            },
            disabled: !this.gameTableMask.isMine || this.isNonScratching
          },
          { 
            name: '파기하고 계속한다' , action: () => {
              if (!this.gameTableMask.isMine) return;
              this.ngZone.run(() => {
                this.scratchingGrids = '';
                clearTimeout(this._scratchingTimerId);
                this._currentScratchingSet = null;
              });
              this._scratchingGridX = -1;
              this._scratchingGridY = -1;
              SoundEffect.play(PresetSound.sweep);
            },
            disabled: !this.gameTableMask.isMine || this.isNonScratching
          },
          ContextMenuSeparator,
          (this.isPreview
            ? {
              name: '프리뷰 모드 해제', action: () => {
                if (!this.gameTableMask.isMine) return;
                this.ngZone.run(() => {
                  this.isPreview = false;
                });
                SoundEffect.play(PresetSound.lock);
              },
              selfOnly: true,
              disabled: !this.gameTableMask.isMine
            }
            : {
              name: '프리뷰 모드 개시', action: () => {
                if (!this.gameTableMask.isMine) return;
                this.modalService.open(ConfirmationComponent, {
                  title: '스크래치 프리뷰 모드', 
                  text: '스크래치 안에 적용 후의 상태를 표시합니까?',
                  helpHtml: '자신한테만, <b>이 스크래치를 확정/취소할 때까지</b>맵 마스크는 투과 표시가 되고 또한 스크래치 적용 후의 상태를 표시합니다.',
                  type: ConfirmationType.OK_CANCEL,
                  materialIcon: 'visibility',
                  action: () => {
                    this.ngZone.run(() => {
                      this.isPreview = true;
                    });
                    SoundEffect.play(PresetSound.unlock);
                    this.chatMessageService.sendOperationLog(`${ this.gameTableMask.name == '' ? '(이름 없는 맵 마스크)' : this.gameTableMask.name } 의 스크래치를 프리뷰 모드로 했다`);
                  }
                });
              }, 
              selfOnly: true,
              disabled: !this.gameTableMask.isMine
            }
          ),
          { 
            name: '스크래치 초기화' , action: () => {
              if (!this.gameTableMask.isMine) return;
              this.modalService.open(ConfirmationComponent, {
                title: '스크래치 초기화', 
                text: '스크래치를 초기화합니까?',
                help: '맵 마스크는 스크래치되지 않은 상태가 되어 조작을 종료합니다.',
                type: ConfirmationType.OK_CANCEL,
                materialIcon: 'draw',
                action: () => {
                  this.ngZone.run(() => {
                    this.gameTableMask.owner = '';
                    this.scratchedGrids = '';
                    this.scratchingGrids = '';
                    this._currentScratchingSet = null;
                    clearTimeout(this._scratchingTimerId);
                  });
                  this._scratchingGridX = -1;
                  this._scratchingGridY = -1;
                  SoundEffect.play(PresetSound.sweep);
                  this.chatMessageService.sendOperationLog(`${ this.gameTableMask.name == '' ? '(이름 없는 맵 마스크)' : this.gameTableMask.name } 의 스크래치를 초기화했다`);
                }
              });
            },
            disabled: !this.gameTableMask.isMine || this.isNonScratched
          }
        ],
        disabled: !this.gameTableMask.isMine
      },
      ContextMenuSeparator,
      {
        name: '가장자리 라인의 표시',
        subActions: [
          { name: `${this.borderType == 0 ? '◉' : '○'} 조작시에만 표시`,  action: () => { this.borderType = 0 }, checkBox: 'radio' },
          { name: `${this.borderType == 1 ? '◉' : '○'} 조작시에만 고정되지 않음`,  action: () => { this.borderType = 1 }, checkBox: 'radio' },
          { name: `${this.borderType == 2 ? '◉' : '○'} 항상 표시`,  action: () => { this.borderType = 2 }, checkBox: 'radio' },
        ],
        disabled: this.isScratching
      },
      {
        name: '이미지와 색의 표시',
        subActions: [
          { name: `${this.blendType == 0 ? '◉' : '○'} 이미지만`,  action: () => { this.blendType = 0; SoundEffect.play(PresetSound.cardDraw) }, checkBox: 'radio' },
          { name: `${this.blendType == 1 ? '◉' : '○'} 배경색과 겹친다`,  action: () => { this.blendType = 1; SoundEffect.play(PresetSound.cardDraw) }, checkBox: 'radio' },
          { name: `${this.blendType == 2 ? '◉' : '○'} 배경색과 섞는다`,  action: () => { this.blendType = 2; SoundEffect.play(PresetSound.cardDraw) }, checkBox: 'radio' },
          ContextMenuSeparator,
          { name: '색의 초기화', action: () => { this.color = '#555555'; this.bgcolor = '#0a0a0a'; SoundEffect.play(PresetSound.cardDraw) } }
        ],
        disabled: this.isScratching
      },
      ContextMenuSeparator,
      (this.isAltitudeIndicate
        ? {
          name: '☑ 고도 표시', action: () => {
            this.isAltitudeIndicate = false;
          },
          checkBox: 'check'
        } : {
          name: '☐ 고도 표시', action: () => {
            this.isAltitudeIndicate = true;
          },
          checkBox: 'check'
        }),
      {
        name: '고도를 0으로 한다', action: () => {
          if (this.altitude != 0) {
            this.altitude = 0;
            SoundEffect.play(PresetSound.sweep);
          }
        },
        disabled: this.isScratching,
        altitudeHande: this.gameTableMask,
        altitudeDisabled: this.isScratching
      },
      ContextMenuSeparator,
      { name: '맵 마스크를 편집...', action: () => { this.showDetail(this.gameTableMask); } },
      (this.gameTableMask.getUrls().length <= 0 ? null : {
        name: '참조 URL을 연다', action: null,
        subActions: this.gameTableMask.getUrls().map((urlElement) => {
          const url = urlElement.value.toString();
          return {
            name: urlElement.name ? urlElement.name : url,
            action: () => {
              if (StringUtil.sameOrigin(url)) {
                window.open(url.trim(), '_blank', 'noopener');
              } else {
                this.modalService.open(OpenUrlComponent, { url: url, title: this.gameTableMask.name, subTitle: urlElement.name });
              } 
            },
            disabled: !StringUtil.validUrl(url),
            error: !StringUtil.validUrl(url) ? 'URL이 올바르지 않습니다' : null,
            isOuterLink: StringUtil.validUrl(url) && !StringUtil.sameOrigin(url)
          };
        })
      }),
      (this.gameTableMask.getUrls().length <= 0 ? null : ContextMenuSeparator),
      {
        name: '사본을 작성', action: () => {
          let cloneObject = this.gameTableMask.clone();
          console.log('사본', cloneObject);
          cloneObject.location.x += this.gridSize;
          cloneObject.location.y += this.gridSize;
          cloneObject.isLock = false;
          cloneObject.isPreview = false;
          if (this.gameTableMask.parent) this.gameTableMask.parent.appendChild(cloneObject);
          SoundEffect.play(PresetSound.cardPut);
        }
      },
      {
        name: '삭제', action: () => {
          this.chatMessageService.sendOperationLog(`${ this.gameTableMask.name == '' ? '(이름 없는 맵 마스크)' : this.gameTableMask.name } 를 삭제했다`);
          this.gameTableMask.destroy();
          SoundEffect.play(PresetSound.sweep);
        }
      },
      ContextMenuSeparator,
      { name: '오브젝트 작성', action: null, subActions: this.tabletopActionService.makeDefaultContextMenuActions(objectPosition) }
    ];
    
    return actions;
  }

  private showDetail(gameObject: GameTableMask) {
    let coordinate = this.pointerDeviceService.pointers[0];
    let title = '맵 마스크 설정';
    if (gameObject.name.length) title += ' - ' + gameObject.name;
    let option: PanelOption = { title: title, left: coordinate.x - 200, top: coordinate.y - 150, width: 400, height: 530 };
    let component = this.panelService.open<GameCharacterSheetComponent>(GameCharacterSheetComponent, option);
    component.tabletopObject = gameObject;
  }
  
  identify(index, gridInfo){
    return `${this.panelId}:${gridInfo.x}:${gridInfo.y}`;
  }
}