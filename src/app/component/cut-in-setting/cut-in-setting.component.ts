import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CutInList } from '@udonarium/cut-in-list';
import { CutIn } from '@udonarium/cut-in';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { ObjectSerializer } from '@udonarium/core/synchronize-object/object-serializer';
import { PointerDeviceService } from 'service/pointer-device.service';
import { ModalService } from 'service/modal.service';
import { PanelOption, PanelService } from 'service/panel.service';
import { SaveDataService } from 'service/save-data.service';
import { EventSystem } from '@udonarium/core/system';
import { TextViewComponent } from 'component/text-view/text-view.component';
import { ImageFile } from '@udonarium/core/file-storage/image-file';
import { ImageStorage } from '@udonarium/core/file-storage/image-storage';
import { ImageTag } from '@udonarium/image-tag';
import { FileSelecterComponent } from 'component/file-selecter/file-selecter.component';
import { CutInService } from 'service/cut-in.service';
import { PeerCursor } from '@udonarium/peer-cursor';
import { AudioFile } from '@udonarium/core/file-storage/audio-file';
import { AudioStorage } from '@udonarium/core/file-storage/audio-storage';
import { UUID } from '@udonarium/core/system/util/uuid';
import { OpenUrlComponent } from 'component/open-url/open-url.component';
import { CutInComponent } from 'component/cut-in/cut-in.component';
import { ConfirmationComponent, ConfirmationType } from 'component/confirmation/confirmation.component';


@Component({
  selector: 'app-cut-in-setting',
  templateUrl: './cut-in-setting.component.html',
  styleUrls: ['./cut-in-setting.component.css']
})
export class CutInSettingComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('cutInSelecter') cutInSelecter: ElementRef<HTMLSelectElement>;
  readonly minSize: number = 0;
  readonly maxSize: number = 100;

  panelId: string;

  isShowHideImages = false;
  selectedCutIn: CutIn = null;
  selectedCutInXml: string = '';

  get cutIns(): CutIn[] { return CutInList.instance.cutIns; }

  get cutInName(): string { return this.selectedCutIn.name; }
  set cutInName(cutInName: string) { if (this.isEditable) this.selectedCutIn.name = cutInName; }

  get cutInTag(): string { return this.selectedCutIn.tag; }
  set cutInTag(cutInTag: string) { if (this.isEditable) this.selectedCutIn.tag = cutInTag; }

  get cutInDuration(): number { return this.selectedCutIn.duration; }
  set cutInDuration(cutInDuration: number) { if (this.isEditable) this.selectedCutIn.duration = cutInDuration; }

  get cutInCond(): string { return this.selectedCutIn.value + ''; }
  set cutInCond(cutInCond: string) { if (this.isEditable) this.selectedCutIn.value = cutInCond; }

  get cutInIsPreventOutBounds(): boolean { return this.selectedCutIn.isPreventOutBounds; }
  set cutInIsPreventOutBounds(isPreventOutBounds: boolean) { if (this.isEditable) this.selectedCutIn.isPreventOutBounds = isPreventOutBounds; }

  get cutInWidth(): number { return this.selectedCutIn.width; }
  set cutInWidth(cutInWidth: number) { if (this.isEditable) this.selectedCutIn.width = cutInWidth; }

  get cutInHeight(): number { return this.selectedCutIn.height; }
  set cutInHeight(cutInHeight: number) { if (this.isEditable) this.selectedCutIn.height = cutInHeight; }

  get objectFitType(): number { return this.selectedCutIn.objectFitType; }
  set objectFitType(objectFitType: number) { if (this.isEditable) this.selectedCutIn.objectFitType = objectFitType; }

  get cutInPosX(): number { return this.selectedCutIn.posX; }
  set cutInPosX(cutInPosX: number) { if (this.isEditable) this.selectedCutIn.posX = cutInPosX; }

  get cutInPosY(): number { return this.selectedCutIn.posY; }
  set cutInPosY(cutInPosY: number) { if (this.isEditable) this.selectedCutIn.posY = cutInPosY; }

  get cutInZIndex(): number { return this.selectedCutIn.zIndex; }
  set cutInZIndex(cutInZIndex: number) { if (this.isEditable) this.selectedCutIn.zIndex = cutInZIndex; }

  get cutInIsFrontOfStand(): boolean { return this.selectedCutIn.isFrontOfStand; }
  set cutInIsFrontOfStand(isFrontOfStand: boolean) { if (this.isEditable) this.selectedCutIn.isFrontOfStand = isFrontOfStand; }

  get cutInAudioIdentifier(): string { return this.selectedCutIn.audioIdentifier; }
  set cutInAudioIdentifier(audioIdentifier: string) { if (this.isEditable) this.selectedCutIn.audioIdentifier = audioIdentifier; }
  
  get cutInAudioFileName(): string { return this.selectedCutIn.audioFileName; }
  set cutInAudioFileName(audioFileName: string) { if (this.isEditable) this.selectedCutIn.audioFileName = audioFileName; }

  get cutInSEIsLoop(): boolean { return this.selectedCutIn.isLoop; }
  set cutInSEIsLoop(isLoop: boolean) { if (this.isEditable) this.selectedCutIn.isLoop = isLoop; }

  get cutInType(): number { return this.selectedCutIn.animationType; }
  set cutInType(cutInType: number) { if (this.isEditable) this.selectedCutIn.animationType = cutInType; }

  get borderStyle(): number { return this.selectedCutIn.borderStyle; }
  set borderStyle(borderStyle: number) { if (this.isEditable) this.selectedCutIn.borderStyle = borderStyle; }

  get isEmpty(): boolean { return this.cutIns.length < 1; }
  get isDeleted(): boolean { return this.selectedCutIn ? ObjectStore.instance.get(this.selectedCutIn.identifier) == null : false; }
  get isEditable(): boolean { return !this.isEmpty && !this.isDeleted; }

  get cutInIsVideo(): boolean { return this.selectedCutIn.isVideoCutIn; }
  set cutInIsVideo(isVideo: boolean) { if (this.isEditable) this.selectedCutIn.isVideoCutIn = isVideo; }

  get cutInVideoURL(): string { return this.selectedCutIn.videoUrl; }
  set cutInVideoURL(videoUrl: string) { if (this.isEditable) this.selectedCutIn.videoUrl = videoUrl; }

  get cutInisSoundOnly(): boolean { return this.selectedCutIn.isSoundOnly; }
  set cutInisSoundOnly(isSoundOnly: boolean) { if (this.isEditable)  this.selectedCutIn.isSoundOnly = isSoundOnly; }

  get cutInVideoId(): string {
    if (!this.selectedCutIn) return '';
    return this.selectedCutIn.videoId;
  }

  get cutInPlayListId(): string {
    if (!this.cutInVideoId) return '';
    return this.selectedCutIn.playListId;
  }

  get cutInImage(): ImageFile {
    if (!this.selectedCutIn) return ImageFile.Empty;
    let file = ImageStorage.instance.get(this.selectedCutIn.imageIdentifier);
    return file ? file : ImageFile.Empty;
  }
  
  get cutInImageUrl(): string {
    if (!this.selectedCutIn) return ImageFile.Empty.url;
    return (!this.selectedCutIn.videoId || this.cutInisSoundOnly) ? this.cutInImage.url : `https://img.youtube.com/vi/${this.selectedCutIn.videoId}/hqdefault.jpg`;
  }

  get isPlaying(): boolean {
    if (!this.selectedCutIn) return false;
    return CutInService.nowShowingIdentifiers().includes(this.selectedCutIn.identifier);
  }
  
  get isValidAudio(): boolean {
    if (!this.selectedCutIn) return true;
    return this.selectedCutIn.isValidAudio;
  }
  
  get myPeer(): PeerCursor { return PeerCursor.myCursor; }
  get otherPeers(): PeerCursor[] { return ObjectStore.instance.getObjects(PeerCursor); }

  get myColor(): string {
    if (PeerCursor.myCursor
      && PeerCursor.myCursor.color
      && PeerCursor.myCursor.color != PeerCursor.CHAT_TRANSPARENT_COLOR) {
      return PeerCursor.myCursor.color;
    }
    return PeerCursor.CHAT_DEFAULT_COLOR;
  }

  get sendToColor(): string {
    let object = ObjectStore.instance.get(this.sendTo);
    if (object instanceof PeerCursor) {
      return object.color;
    }
    return PeerCursor.CHAT_DEFAULT_COLOR;
  }

  get audios(): AudioFile[] { return AudioStorage.instance.audios.filter(audio => !audio.isHidden); }

  sendTo: string = '';
  isSaveing: boolean = false;
  progresPercent: number = 0;

  constructor(
    private changeDetector: ChangeDetectorRef,
    private pointerDeviceService: PointerDeviceService,
    private modalService: ModalService,
    private panelService: PanelService,
    private saveDataService: SaveDataService
  ) { }

  ngOnInit(): void {
    Promise.resolve().then(() => this.modalService.title = this.panelService.title = '컷인 설정');
    EventSystem.register(this)
      .on('SYNCHRONIZE_AUDIO_LIST', -1000, event => {
        this.onAudioFileChange();
      });
    this.panelId = UUID.generateUuid();
  }

  ngAfterViewInit() {
    if (this.cutIns.length > 0) {
      queueMicrotask(() => {
        this.onChangeCutIn(this.cutIns[0].identifier);
        this.cutInSelecter.nativeElement.selectedIndex = 0;
      });
    }
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
  }

  onChangeCutIn(identifier: string) {
    this.selectedCutIn = ObjectStore.instance.get<CutIn>(identifier);
    this.selectedCutInXml = '';
  }

  create(name: string = '컷인'): CutIn {
    return CutInList.instance.addCutIn(name)
  }

  add() {
    const cutIn = this.create();
    cutIn.imageIdentifier = 'stand_no_image';
    queueMicrotask(() => {
      this.onChangeCutIn(cutIn.identifier);
      this.cutInSelecter.nativeElement.value = cutIn.identifier;
    })
  }
  
  async save() {
    if (!this.selectedCutIn || this.isSaveing) return;
    this.isSaveing = true;
    this.progresPercent = 0;

    let fileName: string = 'fly_cutIn_' + this.selectedCutIn.name;

    await this.saveDataService.saveGameObjectAsync(this.selectedCutIn, fileName, percent => {
      this.progresPercent = percent;
    });

    setTimeout(() => {
      this.isSaveing = false;
      this.progresPercent = 0;
    }, 500);
  }

  delete() {
    if (!this.selectedCutIn) return;
    EventSystem.call('STOP_CUT_IN', { 
      identifier: this.selectedCutIn.identifier
    });
    if (!this.isEmpty) {
      this.selectedCutInXml = this.selectedCutIn.toXml();
      this.selectedCutIn.destroy();
    }
  }

  restore() {
    if (this.selectedCutIn && this.selectedCutInXml) {
      let restoreCutIn = <CutIn>ObjectSerializer.instance.parseXml(this.selectedCutInXml);
      CutInList.instance.addCutIn(restoreCutIn);
      this.selectedCutInXml = '';
      queueMicrotask(() => {
        const cutIns = this.cutIns;
        this.onChangeCutIn(cutIns[cutIns.length - 1].identifier);
        this.cutInSelecter.nativeElement.selectedIndex = cutIns.length - 1;
      });
    }
  }

  getHidden(image: ImageFile): boolean {
    const imageTag = ImageTag.get(image.identifier);
    return imageTag ? imageTag.hide : false;
  }

  upTabIndex() {
    if (!this.selectedCutIn) return;
    let parentElement = this.selectedCutIn.parent;
    let index: number = parentElement.children.indexOf(this.selectedCutIn);
    if (0 < index) {
      let prevElement = parentElement.children[index - 1];
      parentElement.insertBefore(this.selectedCutIn, prevElement);
    }
  }

  downTabIndex() {
    if (!this.selectedCutIn) return;
    let parentElement = this.selectedCutIn.parent;
    let index: number = parentElement.children.indexOf(this.selectedCutIn);
    if (index < parentElement.children.length - 1) {
      let nextElement = parentElement.children[index + 1];
      parentElement.insertBefore(nextElement, this.selectedCutIn);
    }
  }

  openModal() {
    if (this.isDeleted) return;
    let currentImageIdentifires: string[] = [];
    if (this.selectedCutIn && this.selectedCutIn.imageIdentifier) currentImageIdentifires = [this.selectedCutIn.imageIdentifier];
    this.modalService.open<string>(FileSelecterComponent, { currentImageIdentifires: currentImageIdentifires }).then(value => {
      if (!this.selectedCutIn || !value) return;
      this.selectedCutIn.imageIdentifier = value;
    });
  }

  onShowHiddenImages($event: Event) {
    if (this.isShowHideImages) {
      this.isShowHideImages = false;
    } else {
      $event.preventDefault();
      this.modalService.open(ConfirmationComponent, {
        title: '숨김 설정의 이미지를 표시', 
        text: '숨김 설정의 이미지를 표시합니까?',
        help: '스포일러 등에 주의해주세요.',
        type: ConfirmationType.OK_CANCEL,
        materialIcon: 'visibility',
        action: () => {
          this.isShowHideImages = true;
          (<HTMLInputElement>$event.target).checked = true;
          this.changeDetector.markForCheck();
        }
      });
    }
  }

  playCutIn() {
    if (!this.selectedCutIn) return;
    const sendObj = {
      identifier: this.selectedCutIn.identifier,
      secret: this.sendTo ? true : false,
      sender: PeerCursor.myCursor.peerId
    };
    if (sendObj.secret) {
      const targetPeer = ObjectStore.instance.get<PeerCursor>(this.sendTo);
      if (targetPeer) {
        if (targetPeer.peerId != PeerCursor.myCursor.peerId) EventSystem.call('PLAY_CUT_IN', sendObj, targetPeer.peerId);
        EventSystem.call('PLAY_CUT_IN', sendObj, PeerCursor.myCursor.peerId);
      }
    } else {
      EventSystem.call('PLAY_CUT_IN', sendObj);
    }
  }

  stopCutIn() {
    if (!this.selectedCutIn) return;
    const sendObj = {
      identifier: this.selectedCutIn.identifier,
      secret: this.sendTo ? true : false,
      sender: PeerCursor.myCursor.peerId
    };
    if (sendObj.secret) {
      const targetPeer = ObjectStore.instance.get<PeerCursor>(this.sendTo);
      if (targetPeer) {
        if (targetPeer.peerId != PeerCursor.myCursor.peerId) EventSystem.call('STOP_CUT_IN', sendObj, targetPeer.peerId);
        EventSystem.call('STOP_CUT_IN', sendObj, PeerCursor.myCursor.peerId);
      }
    } else {
      EventSystem.call('STOP_CUT_IN', sendObj);
    }
  }

  testCutIn() {
    if (!this.selectedCutIn) return;
    queueMicrotask(() => {
      EventSystem.trigger('PLAY_CUT_IN', { 
        identifier: this.selectedCutIn.identifier, 
        test: true
      });
    });
  }

  onAudioFileChange(identifier: string='') {
    if (!identifier && this.selectedCutIn) identifier = this.selectedCutIn.audioIdentifier;
    if (identifier == '') {
      this.cutInAudioFileName = '';
      return;
    }
    const audio = AudioStorage.instance.get(identifier);
    this.cutInAudioFileName = audio ? audio.name : '';
  }

  openYouTubeTerms() {
    this.modalService.open(OpenUrlComponent, { url: 'https://www.youtube.com/terms', title: 'YouTube 이용규약' });
    return false;
  }

  helpCutIn() {
    let coordinate = this.pointerDeviceService.pointers[0];
    let option: PanelOption = { left: coordinate.x, top: coordinate.y, width: 600, height: 620 };
    let textView = this.panelService.open(TextViewComponent, option);
    textView.title = '컷인 도움말';
    textView.text = 
`　컷인의 이름, 표시 시간, 위치와 폭과 높이(각각 화면 사이즈에 대한 상대 지정), 채팅 송신시에 컷인이 표시되는 조건을 설정할 수 있습니다. 또, 동영상을 재생하는 경우 및 「가려짐 방지」에 체크를 했을 경우, 화면 내에 들어가도록 위치와 사이즈가 조정됩니다.
　
　가로 위치(PosX)와 세로 위치(PosY)는, 화면의 왼쪽 위구석으로부터 컷인의 중심 위치까지의 거리가 됩니다. 사이즈 폭(Width)과 높이(Height) 중 하나를 0으로 한 경우 원래 이미지의 가로 세로 비율을 유지하며 확대 축소합니다. (단, 커트인의 최소 폭, 높이는 ${CutInComponent.MIN_SIZE}픽셀이 됩니다).
　
　동영상을 재생하는 컷인은 반드시 앞에, 그 외는 나중에 표시되는 컷인 화상이 보다 앞쪽에 출력되지만, 중첩순서(Z-Index)를 지정하는 것으로 제어 가능합니다. 같은 컷인, 동영상을 재생하는 컷인, 같은 태그가 지정된 컷인을 재생하는 경우 이전의 것은 정지됩니다. 또, 채팅 말미 조건을 만족하는 컷인이 다수 있는 경우,

　　・태그가 설정되어 있지 않은 것은 모두
　　・태그가 설정된 것은, 같은 태그의 것 중에서 랜덤으로 1개
　　・동영상을 재생하는 컷인은 상기 중에서 랜덤으로 1개를 선택

입니다.

　컷인은 드래그에 의해서 이동 가능합니다(동영상을 재생하는 컷인은 가장자리를 드래그). 또한 더블 클릭으로 닫거나(자신만 정지), 오른쪽 클릭으로 컨텍스트 메뉴로부터 조작이 가능합니다(「닫는다」「창의 뒤쪽에 표시」「최소화」가 가능, 동영상을 재생하는 컷인은 가장자리에서 접수).

　업로드된 음악 파일을 컷인 표시시의 효과음으로서 설정할 수 있습니다. 음량에는 쥬크 박스의 설정(「테스트(자신만 본다)」의 경우는 시청 음량)이 사용됩니다. 표시 시간이나 수동 조작에 의해서 컷인이 정지했을 때에는, 도중이더라도 음성도 정지합니다. 컷인이나 방 세이브 데이터(zip)에는 음악 파일은 포함되지 않으므로, 필요하면 별도 업로드 해 주세요(컷인과 음악 파일의 링크는 파일의 내용에 따릅니다, 동명의 다른 파일을 업로드해도 재링크 되지않습니다).

　컷인에 동영상을 사용하는 경우, URL은 현재 YouTube만 유효합니다. 동영상을 이용할 때는 권리자 및 YouTube가 정한 이용 약관을 참조해, 준수해 주세요.`;
  }
}
