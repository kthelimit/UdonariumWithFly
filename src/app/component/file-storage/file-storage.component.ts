import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';

import { FileArchiver } from '@udonarium/core/file-storage/file-archiver';
import { ImageFile } from '@udonarium/core/file-storage/image-file';
import { ImageStorage } from '@udonarium/core/file-storage/image-storage';
import { EventSystem, Network } from '@udonarium/core/system';

import { PanelService } from 'service/panel.service';
import { ImageTagList } from '@udonarium/image-tag-list';
import { ImageTag } from '@udonarium/image-tag';
import { animate, keyframes, style, transition, trigger } from '@angular/animations';
import { UUID } from '@udonarium/core/system/util/uuid';
import { ConfirmationComponent, ConfirmationType } from 'component/confirmation/confirmation.component';
import { ModalService } from 'service/modal.service';
import { StringUtil } from '@udonarium/core/system/util/string-util';

@Component({
  selector: 'file-storage',
  templateUrl: './file-storage.component.html',
  styleUrls: ['./file-storage.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('scaleInOut', [
      transition('void => *', [
        animate('200ms ease', keyframes([
          style({ transform: 'scale3d(0, 0, 0)', offset: 0 }),
          style({ transform: 'scale3d(1.0, 1.0, 1.0)', offset: 1.0 })
        ]))
      ]),
      transition('* => void', [
        animate('180ms ease', style({ transform: 'scale3d(0, 0, 0)' }))
      ])
    ]),
    trigger('fadeAndUpInOut', [
      transition('void => *', [
        animate('100ms ease-in-out', keyframes([
          style({ 'transform-origin': 'center bottom', transform: 'translateY(8px) scaleY(0)', opacity: 0.6 }),
          style({ 'transform-origin': 'center bottom', transform: 'translateY(0px) scaleY(1.0)', opacity: 1.0 })
        ]))
      ]),
      transition('* => void', [
        animate('100ms ease-in-out', style({ 'transform-origin': 'center bottom', transform: 'translateY(0px) scaleY(1.0)', opacity: 1.0 })),
        animate('100ms ease-in-out', style({ 'transform-origin': 'center bottom', transform: 'translateY(8px) scaleY(0)', opacity: 0.6 }))
      ])
    ])
  ]
})
export class FileStorageComponent implements OnInit, OnDestroy, AfterViewInit {
  panelId;
  private _searchNoTagImage = true;
  serchCondIsOr = true;
  addingTagWord = '';
  searchWords: string[] = [];
  deletedWords: string[] = [];
  selectedImageFiles: ImageFile[] = [];

  isSort = true;
  static sortOrder: string[] = [];

  isShowHideImages = false;

  //static imageCount = 0;

  get images(): ImageFile[] {
    const searchResultImages = ImageTagList.searchImages(this.searchWords, (this.searchNoTagImage && this.countAllImagesHasWord(null) > 0), this.serchCondIsOr, this.isShowHideImages);
    const searchResultImageIdentifiers = searchResultImages.map(image => image.identifier);
    this.selectedImageFiles = this.selectedImageFiles.filter(image => searchResultImageIdentifiers.includes(image.identifier));
    return this.isSort ? ImageTagList.sortImagesByWords(searchResultImages, FileStorageComponent.sortOrder) : searchResultImages;
  }
  
  get searchNoTagImage(): boolean {
    return this._searchNoTagImage;
  }

  set searchNoTagImage(value: boolean) {
    if (value) {
      FileStorageComponent.sortOrder.unshift(null);
    } else {
      FileStorageComponent.sortOrder = FileStorageComponent.sortOrder.filter(key => key != null);
    }
    FileStorageComponent.sortOrder = Array.from(new Set(FileStorageComponent.sortOrder));
    this._searchNoTagImage = value;
    EventSystem.trigger('CHANGE_SORT_ORDER', null);
  }

  get searchAllImage(): boolean {
    if (!this.searchNoTagImage && this.countAllImagesHasWord(null) > 0) return false;
    for (const word of this.allImagesOwnWords) {
      if (!this.searchWords.includes(word)) {
        return false;
      }
    } 
    return true;
  }

  get isSelected(): boolean {
    let ret = this.selectedImageFiles.length > 0;
    if (!ret) this.addingTagWord = '';
    return ret;
  }

  get selectedImagesIsHidden(): boolean {
    return ImageTagList.imagesIsHidden(this.selectedImageFiles);
  }

  get allImagesOwnWords(): string[] {
    return ImageTagList.allImagesOwnWords(this.isShowHideImages);
  }

  constructor(
    private changeDetector: ChangeDetectorRef,
    private panelService: PanelService,
    private modalService: ModalService
  ) { }
  
  ngOnInit() {
    Promise.resolve().then(() => this.panelService.title = '파일 리스트');
    this.searchWords = this.allImagesOwnWords;
    //FileStorageComponent.sortOrder = [null].concat(this.searchWords);
    this.panelId = UUID.generateUuid();
    // 非表示も含めた数
    //FileStorageComponent.imageCount = ImageStorage.instance.images.length;
  }

  ngAfterViewInit() {
    EventSystem.register(this)
    .on('SYNCHRONIZE_FILE_LIST', event => {
      if (event.isSendFromSelf) {
        /* 自分だけできないかな
        console.log(event.data)
        if (this.serchCondIsOr) {
          let isNotagAdd = false;
          for (let i = FileStorageComponent.imageCount - 1; i < event.data.length; i++) {
            const imageTag = ImageTag.get(event.data[i].identifier);
            let noTag = true;
            if (imageTag && imageTag.tag != null && imageTag.tag.trim() != '') {
              if (this.isShowHideImages || !imageTag.hide) {
                for (const word of imageTag.words) {
                  FileStorageComponent.sortOrder.unshift(word);
                  this.searchWords.push(word);
                }
              }
              noTag = false;
            }
            isNotagAdd = isNotagAdd || noTag;
          }
          if (isNotagAdd) {
            FileStorageComponent.sortOrder.unshift(null);
            this._searchNoTagImage = true;
          }
          FileStorageComponent.sortOrder = Array.from(new Set(FileStorageComponent.sortOrder));
          this.searchWords = Array.from(new Set(this.searchWords)).sort();
        }
        */
        this.changeDetector.markForCheck();
      }
      //FileStorageComponent.imageCount = event.data.length;
    })
    .on('OPERATE_IMAGE_TAGS', event => {
      this.changeDetector.markForCheck();
    })
    .on('CHANGE_SORT_ORDER', event => {
      if (event.isSendFromSelf) this.changeDetector.markForCheck();
    });
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
  }

  allImages(): ImageFile[] {
    return ImageTagList.allImages(this.isShowHideImages);
  }

  countAllImagesHasWord(word): number {
    return ImageTagList.countAllImagesHasWord(word, this.isShowHideImages);
  }

  countImagesHasWord(word): number {
    let count = 0;
    if (word != null && word.trim() === '') return count;
    for (const imageFile of this.images) {
      const imageTag = ImageTag.get(imageFile.identifier);
      if (word == null) {
        if (!imageTag || imageTag.tag == null || imageTag.tag.trim() == '') count++;
      } else {
        if (imageTag && imageTag.containsWords(word.trim(), false)) count++;
      }
    }
    return count;
  }

  handleFileSelect(event: Event) {
    let input = <HTMLInputElement>event.target;
    let files = input.files;
    if (files.length) FileArchiver.instance.load(files);
    input.value = '';
  }

  selected(file: ImageFile) {
    return this.selectedImageFiles.map(imageFile => imageFile.identifier).includes(file.identifier)
  }

  selectedImagesOwnWords(hasAll=false): string[] {
    return ImageTagList.imagesOwnWords(this.selectedImageFiles, hasAll);
  }

  onSelectedWord(searchWord: string) {
    //this.selectedImageFiles = [];
    if (searchWord == null || searchWord.trim() === '') return;
    if (this.searchWords.includes(searchWord)) {
      this.searchWords = this.searchWords.filter(word => searchWord !== word);
      FileStorageComponent.sortOrder = FileStorageComponent.sortOrder.filter(word => searchWord !== word);
    } else {
      this.searchWords.push(searchWord);
      FileStorageComponent.sortOrder.unshift(searchWord);
    }
    FileStorageComponent.sortOrder = Array.from(new Set(FileStorageComponent.sortOrder));
    EventSystem.trigger('CHANGE_SORT_ORDER', searchWord);
  }

  onSelectedFile(file: ImageFile) {
    if (this.selected(file)) {
      this.selectedImageFiles = this.selectedImageFiles.filter(imageFile => imageFile.identifier !== file.identifier);
    } else {
      this.selectedImageFiles.push(file);
    }
  }

  getTagWords(image: ImageFile): string[] {
    const imageTag = ImageTag.get(image.identifier);
    //console.log(imageTag ? imageTag.words : []);
    return imageTag ? imageTag.words : [];
  }

  getHidden(image: ImageFile): boolean {
    const imageTag = ImageTag.get(image.identifier);
    return imageTag ? imageTag.hide : false;
  }

  onSearchAllImage() {
    if (this.searchAllImage) {
      this.searchWords = [];
      this._searchNoTagImage = false;
    } else {
      this.searchWords = this.allImagesOwnWords;
      this._searchNoTagImage = true;
    }
  }

  onUnselect() {
    this.selectedImageFiles = [];
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

  setectedImagesToHidden(toHidden: boolean) {
    this.modalService.open(ConfirmationComponent, {
      title: toHidden ? '숨김으로 설정' : '숨김 설정을 삭제', 
      text: `이미지${ toHidden ? '숨김으로 설정' : '의 숨김 설정을 삭제'}할까요?`,
      help: toHidden ? '선택한 이미지를 숨김 설정으로 합니다. \n이것은 「의도치않게 스포일러를 접한다」같은 상황을 방지하기 위한 것으로 다른 사람으로부터 완전히 숨길 수 있는 것은 아닙니다.' : '선택한 이미지의 숨김 설정을 삭제합니다.',
      type: ConfirmationType.OK_CANCEL,
      materialIcon: toHidden ? 'visibility_off' : 'visibility',
      action: () => {
        for (const image of this.selectedImageFiles) {
          const imageTag = ImageTag.get(image.identifier) || ImageTag.create(image.identifier);
          imageTag.hide = toHidden;
          EventSystem.call('OPERATE_IMAGE_TAGS', imageTag.identifier);
        }
      }
    });
  }

  addTagWord() {
    if (this.addingTagWord == null || this.addingTagWord.trim() == '') return;
    const words = this.addingTagWord.trim().split(/\s+/);
    this.modalService.open(ConfirmationComponent, {
      title: '이미지에 태그를 추가', 
      text: `이미지에 태그를 추가합니까?`,
      helpHtml: '선택한 이미지에 ' + words.map(word => `<b class="word-tag">${ StringUtil.escapeHtml(word) }</b>`).join(' ') + ' 태그를 추가합니다.',
      type: ConfirmationType.OK_CANCEL,
      materialIcon: 'sell',
      action: () => {
        let addedWords = null;
        for (const image of this.selectedImageFiles) {
          const imageTag = ImageTag.get(image.identifier) || ImageTag.create(image.identifier);
          //imageTag.addWords(words);
          //TODO いまのところ全部帰ってくるが実際に追加したタグだけを返して追加したい
          addedWords = imageTag.addWords(words);
        }
        if (addedWords) {
          if (this.serchCondIsOr) this.searchWords.push(...addedWords);
          FileStorageComponent.sortOrder.unshift(...addedWords);
        }
        if (this.serchCondIsOr) this.searchWords = Array.from(new Set(this.searchWords)).sort();
        FileStorageComponent.sortOrder = Array.from(new Set(FileStorageComponent.sortOrder));
        EventSystem.trigger('CHANGE_SORT_ORDER', addedWords);
        this.addingTagWord = '';
      }
    });
  }

  removeTagWord(word: string) {
    this.modalService.open(ConfirmationComponent, {
      title: '이미지로부터 태그를 삭제', 
      text: `이미지로부터 태그를 삭제합니까?`,
      helpHtml: `선택한 이미지로부터 <b class="word-tag">${ StringUtil.escapeHtml(word) }</b> 태그를 삭제합니다.`,
      type: ConfirmationType.OK_CANCEL,
      materialIcon: 'sell',
      action: () => {
        if (word == null || word.trim() == '') return;
        for (const image of this.selectedImageFiles) {
          let imageTag = ImageTag.get(image.identifier);
          if (imageTag) imageTag.removeWords(word);
        }
        const allImagesOwnWords = this.allImagesOwnWords;
        this.searchWords = this.searchWords.filter(word => allImagesOwnWords.includes(word));
        this.deletedWords.push(word);
        this.deletedWords = Array.from(new Set(this.deletedWords));
        EventSystem.trigger('CHANGE_SORT_ORDER', this.deletedWords);
      }
    });
  }

  identify(index, image){
    return image.identifier;
  }

  suggestWords(): string[] {
    const selectedWords = this.selectedImagesOwnWords(true);
    return Array.from(new Set(this.allImagesOwnWords.concat(this.deletedWords))).filter(word => word.indexOf('*') !== 0 && !selectedWords.includes(word));
  }
}
