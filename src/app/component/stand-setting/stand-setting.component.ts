import { AfterViewInit, Component, ElementRef, Input, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { EventSystem } from '@udonarium/core/system';
import { PanelOption, PanelService } from 'service/panel.service';
import { DataElement } from '@udonarium/data-element';
import { GameCharacter } from '@udonarium/game-character';
import { ImageStorage } from '@udonarium/core/file-storage/image-storage';
import { ImageFile } from '@udonarium/core/file-storage/image-file';
import { StandElementComponent } from 'component/stand-element/stand-element.component';
import { UUID } from '@udonarium/core/system/util/uuid';
import { PointerDeviceService } from 'service/pointer-device.service';
import { TextViewComponent } from 'component/text-view/text-view.component';
import { ObjectSerializer } from '@udonarium/core/synchronize-object/object-serializer';
import { ConfirmationComponent, ConfirmationType } from 'component/confirmation/confirmation.component';
import { ModalService } from 'service/modal.service';

@Component({
  selector: 'app-stand-setting',
  templateUrl: './stand-setting.component.html',
  styleUrls: ['./stand-setting.component.css']
})
export class StandSettingComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() character: GameCharacter = null;
　@ViewChildren(StandElementComponent) standElementComponents: QueryList<StandElementComponent>;

  panelId: string;
  standSettingXML = '';

  private _intervalId;
  private isSpeaking = false;

  constructor(
    private panelService: PanelService,
    private pointerDeviceService: PointerDeviceService,
    private modalService: ModalService
  ) { }

  get standElements(): DataElement[] {
    return this.character.standList.standElements;
  }

  get imageList(): ImageFile[] {
    if (!this.character) return [];
    let ret = [];
    let dupe = {};
    const tmp = this.character.imageDataElement.getElementsByName('imageIdentifier');
    const elements = tmp.concat(this.character.imageDataElement.getElementsByName('faceIcon'));
    for (let elm of elements) {
      if (dupe[elm.value]) continue;
      let file = this.imageElementToFile(elm);
      if (file) {
        dupe[elm.value] = true;
        ret.push(file);
      }
    }
    return ret;
  }

  get position(): number {
    if (!this.character || !this.character.standList) return 0;
    return this.character.standList.position;
  }

  set position(position: number) {
    if (!this.character || !this.character.standList) return;
    this.character.standList.position = position;
  }

  get height(): number {
    if (!this.character || !this.character.standList) return 0;
    return this.character.standList.height;
  }

  set height(height: number) {
    if (!this.character || !this.character.standList) return;
    this.character.standList.height = height;
  }

  get overviewIndex(): number {
    if (!this.character || !this.character.standList) return -1;
    return this.character.standList.overviewIndex;
  }

  set overviewIndex(overviewIndex: number) {
    if (!this.character || !this.character.standList) return;
    this.character.standList.overviewIndex = overviewIndex;
  }

  ngOnInit() {
    Promise.resolve().then(() => this.updatePanelTitle());
    EventSystem.register(this)
      .on('DELETE_GAME_OBJECT', -1000, event => {
        if (this.character && this.character.identifier === event.data.identifier) {
          this.panelService.close();
        }
      });
    this.panelId = UUID.generateUuid();
  }

  ngAfterViewInit() {
    this._intervalId = setInterval(() => {
      this.isSpeaking = !this.isSpeaking;
      this.standElementComponents.forEach(standElementComponent => {
        standElementComponent.isSpeaking = this.isSpeaking;
      });
    }, 3600);
  }

  ngOnDestroy() {
    clearInterval(this._intervalId)
    EventSystem.unregister(this);
  }

  updatePanelTitle() {
    this.panelService.title = this.character.name + ' 의 스탠딩 설정';
  }

  add() {
    this.character.standList.add(this.character.imageFile.identifier);
    this.standSettingXML = '';
  }

  delele(standElement: DataElement, index: number) {
    EventSystem.call('DELETE_STAND_IMAGE', {
      characterIdentifier: this.character.identifier,
      identifier: standElement.identifier
    });
    if (!this.character || !this.character.standList) return;
    this.modalService.open(ConfirmationComponent, {
      title: '스탠딩 설정의 삭제', 
      text: '스탠딩 설정을 삭제합니까?',
      type: ConfirmationType.OK_CANCEL,
      materialIcon: 'person_off',
      action: () => {
        this.standSettingXML = standElement.toXml();
        let elm = this.character.standList.removeChild(standElement);
        if (elm) {
          if (this.character.standList.overviewIndex == index) {
            this.character.standList.overviewIndex = -1;
          } else if (this.character.standList.overviewIndex > index) {
            this.character.standList.overviewIndex -= 1;
          }
        }
      }
    });
  }
  
  restore() {
    if (!this.standSettingXML) return;
    let restoreStand = <DataElement>ObjectSerializer.instance.parseXml(this.standSettingXML);
    this.character.standList.appendChild(restoreStand);
    this.standSettingXML = '';
  }

  upStandIndex(standElement: DataElement) {
    this.standSettingXML = '';
    let parentElement = this.character.standList;
    let index: number = parentElement.children.indexOf(standElement);
    if (0 < index) {
      let prevElement = parentElement.children[index - 1];
      parentElement.insertBefore(standElement, prevElement);
      if (this.character.standList.overviewIndex == index) {
        this.character.standList.overviewIndex -= 1;
      } else if (this.character.standList.overviewIndex == index - 1) {
        this.character.standList.overviewIndex += 1;
      } 
    }
  }

  downStandIndex(standElement: DataElement) {
    this.standSettingXML = '';
    let parentElement = this.character.standList;
    let index: number = parentElement.children.indexOf(standElement);
    if (index < parentElement.children.length - 1) {
      let nextElement = parentElement.children[index + 1];
      parentElement.insertBefore(nextElement, standElement);
      if (this.character.standList.overviewIndex == index) {
        this.character.standList.overviewIndex += 1;
      } else if (this.character.standList.overviewIndex == index + 1) {
        this.character.standList.overviewIndex -= 1;
      } 
    }
  }

  helpStandSeteing() {
    let coordinate = this.pointerDeviceService.pointers[0];
    let option: PanelOption = { left: coordinate.x, top: coordinate.y, width: 600, height: 590 };
    let textView = this.panelService.open(TextViewComponent, option);
    textView.title = '스탠딩 설정 도움말';
    textView.text = 
`　캐릭터의 스탠딩 이름, 위치와 이미지 높이(각각 화면 크기에 대한 상대 지정), 채팅 발송 시 스탠딩이 표시되는 조건을 설정할 수 있습니다.

스탠딩에 이름을 설정한 경우, 채팅 윈도우, 채팅 패널의 리스트에 표시되며 선택할 수 있게 됩니다. 또, 태그를 설정한 경우, 다른 태그에서는 같은 캐릭터라고 하더라도 등장, 퇴장의 애니메이션이 진행됩니다.

　화상의 위치와 높이는 개별 지정도 가능합니다. 위치의 개별 지정은 체크 없음, 높이는 0으로 한 경우에 전체의 설정이 사용됩니다. 세로 위치 조정(AdjY)은 스탠딩 화상의 높이에 대한 상대지정이 됩니다. (예를 들어 -50%로 하면 화상의 하반신이 화면단보다 아래에 가려집니다.)

　조건의 「지정화상」은 채팅 송신 시의 캐릭터 화상 또는 얼굴 IC입니다. 또 특별한 조건으로서 항상 채팅 텍스트의 끝이 "@퇴장" 또는 "@farewell"인 경우, 그 캐릭터의 스탠딩이 사라집니다.

　우선순위가 높은 것부터

　　１. "@퇴장"、"@farewell"에 의한 퇴장
　　２. 채팅 윈도우, 채팅 패널의 리스트에서 선택한 이름
　　３. 「지정 이미지 동시에 채팅의 말미(끝)」
　　４. 「지정 이미지 또는 채팅의 말미(끝)」
　　５. 「채팅의 말미(끝)」
　　６. 「지정화상」

　어떤 조건도 만족하지 못한 경우 「디폴트」의 것이 사용되며 동일한 우선순위의 조건이 여러개인 경우 무작위로 하나가 선택됩니다.

　채팅 끝 일치 판정 시, 전각반각, 알파벳 대소문자는 구분되지 않습니다.
또  "@퇴장" 또는 "@farewell"에 의한 퇴장시 혹은 "@웃음"과 같이 선두가 "@"로 시작하는 조건을 설정한 경우, (스탠드의 유효무효, 조건을 만족시키는가에 관계없이) 그 캐릭터로 송신할 때 조건에 일치하는 채팅 끝의 @이하는 잘립니다.`;
  }

  private imageElementToFile(dataElm: DataElement): ImageFile {
    if (!dataElm) return null;
    return ImageStorage.instance.get(<string>dataElm.value);
  }
}
