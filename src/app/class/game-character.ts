import { ChatPalette } from './chat-palette';
import { SyncObject, SyncVar } from './core/synchronize-object/decorator';
import { DataElement } from './data-element';
import { TabletopObject } from './tabletop-object';
import { UUID } from '@udonarium/core/system/util/uuid';

import { StandList } from './stand-list';
import { Network } from './core/system';
import { PeerCursor } from './peer-cursor';
import { ObjectStore } from './core/synchronize-object/object-store';

@SyncObject('character')
export class GameCharacter extends TabletopObject {
  constructor(identifier: string = UUID.generateUuid()) {
    super(identifier);
    this.isAltitudeIndicate = true;
  }

  @SyncVar() rotate: number = 0;
  @SyncVar() roll: number = 0;
  @SyncVar() isDropShadow: boolean = true;
  @SyncVar() isShowChatBubble: boolean = true;
  @SyncVar() owner: string = '';
  
  text = '';
  isEmote = false;
  isLoaded = false;

  get name(): string { return this.getCommonValue('name', ''); }
  set name(name) { this.setCommonValue('name', name); }
  get size(): number { return this.getCommonValue('size', 1); }
  get height(): number {
    let element = this.getElement('height', this.commonDataElement);
    if (!element && this.commonDataElement) {
      this.commonDataElement.insertBefore(DataElement.create('height', 0, { 'currentValue': '' }, 'height_' + this.identifier), this.getElement('altitude', this.commonDataElement));
    }
    let num = element ? +element.value : 0;
    if (element && element.currentValue) num = (Number.isNaN(num) ? 0 : num) * this.size;
    return Number.isNaN(num) ? 0 : num;
  }

  get chatPalette(): ChatPalette {
    for (let child of this.children) {
      if (child instanceof ChatPalette) return child;
    }
    return null;
  }

  get ownerName(): string {
    let object = PeerCursor.findByUserId(this.owner);
    return object ? object.name : null;
  }

  get ownerColor(): string {
    let object = PeerCursor.findByUserId(this.owner);
    return object ? object.color : '#444444';
  }
  
  get standList(): StandList {
    for (let child of this.children) {
      if (child instanceof StandList) return child;
    }
    let standList = new StandList('StandList_' + this.identifier);
    standList.initialize();
    this.appendChild(standList);
    return standList;
  }

  static create(name: string, size: number, imageIdentifier: string): GameCharacter {
    let gameCharacter: GameCharacter = new GameCharacter();
    gameCharacter.createDataElements();
    gameCharacter.initialize();
    gameCharacter.createTestGameDataElement(name, size, imageIdentifier);

    return gameCharacter;
  }

  get isHideIn(): boolean { return !!this.owner; }
  get isVisible(): boolean { return !this.owner || Network.peerContext.userId === this.owner; }

  static get isStealthMode(): boolean {
    for (const character of ObjectStore.instance.getObjects(GameCharacter)) {
      if (character.isHideIn && character.isVisible && character.location.name === 'table') return true;
    }
    return false;
  }

  createTestGameDataElement(name: string, size: number, imageIdentifier: string) {
    this.createDataElements();

    let nameElement: DataElement = DataElement.create('name', name, {}, 'name_' + this.identifier);
    let sizeElement: DataElement = DataElement.create('size', size, {}, 'size_' + this.identifier);
    let heightElement: DataElement = DataElement.create('height', 0, { 'currentValue': '' }, 'height_' + this.identifier);
    let altitudeElement: DataElement = DataElement.create('altitude', 0, {}, 'altitude_' + this.identifier);

    if (this.imageDataElement.getFirstElementByName('imageIdentifier')) {
      this.imageDataElement.getFirstElementByName('imageIdentifier').value = imageIdentifier;
    }

    let resourceElement: DataElement = DataElement.create('리소스', '', {}, '리소스' + this.identifier);
    let hpElement: DataElement = DataElement.create('HP', 200, { 'type': 'numberResource', 'currentValue': '200' }, 'HP_' + this.identifier);
    let mpElement: DataElement = DataElement.create('MP', 100, { 'type': 'numberResource', 'currentValue': '100' }, 'MP_' + this.identifier);

    this.commonDataElement.appendChild(nameElement);
    this.commonDataElement.appendChild(sizeElement);
    this.commonDataElement.appendChild(heightElement);
    this.commonDataElement.appendChild(altitudeElement);

    this.detailDataElement.appendChild(resourceElement);
    resourceElement.appendChild(hpElement);
    resourceElement.appendChild(mpElement);

    //TEST
    let testElement: DataElement = DataElement.create('정보', '', {}, '정보' + this.identifier);
    this.detailDataElement.appendChild(testElement);
    testElement.appendChild(DataElement.create('설명', '여기세 설명을 적는다\nあいうえお', { 'type': 'note' }, '설명' + this.identifier));
    testElement.appendChild(DataElement.create('메모', '임의의 문자열\n１\n２\n３\n４\n５', { 'type': 'note' }, '메모' + this.identifier));
    testElement.appendChild(DataElement.create('참조URL', 'https://www.example.com', { 'type': 'url' }, '참조URL' + this.identifier));

    //TEST
    testElement = DataElement.create('능력', '', {}, '능력' + this.identifier);
    this.detailDataElement.appendChild(testElement);
    testElement.appendChild(DataElement.create('기용도', 24, { 'type': 'abilityScore', 'currentValue': 'div6' }, '기용도' + this.identifier));
    testElement.appendChild(DataElement.create('민첩', 24, { 'type': 'abilityScore', 'currentValue': 'div6' }, '민첩' + this.identifier));
    testElement.appendChild(DataElement.create('근력', 24, { 'type': 'abilityScore', 'currentValue': 'div6' }, '근력' + this.identifier));
    testElement.appendChild(DataElement.create('생명력', 24, { 'type': 'abilityScore', 'currentValue': 'div6' }, '생명력' + this.identifier));
    testElement.appendChild(DataElement.create('지력', 24, { 'type': 'abilityScore', 'currentValue': 'div6' }, '지력' + this.identifier));
    testElement.appendChild(DataElement.create('정신력', 24, { 'type': 'abilityScore', 'currentValue': 'div6' }, '정신력' + this.identifier));

    //TEST
    testElement = DataElement.create('전투 특기', '', {}, '전투 특기' + this.identifier);
    this.detailDataElement.appendChild(testElement);
    testElement.appendChild(DataElement.create('Lv1', '전력공격', {}, 'Lv1' + this.identifier));
    testElement.appendChild(DataElement.create('Lv3', '무기숙련/검', {}, 'Lv3' + this.identifier));
    testElement.appendChild(DataElement.create('Lv5', '무기숙련/검Ⅱ', {}, 'Lv5' + this.identifier));
    testElement.appendChild(DataElement.create('Lv7', '완강', {}, 'Lv7' + this.identifier));
    testElement.appendChild(DataElement.create('Lv9', '베어넘기기', {}, 'Lv9' + this.identifier));
    testElement.appendChild(DataElement.create('자동', '치유적정', {}, '자동' + this.identifier));

    let domParser: DOMParser = new DOMParser();
    let gameCharacterXMLDocument: Document = domParser.parseFromString(this.rootDataElement.toXml(), 'application/xml');

    let palette: ChatPalette = new ChatPalette('ChatPalette_' + this.identifier);
    palette.setPalette(`채팅 팔레트 입력 예시：
2d6+1 다이스 롤
１ｄ２０＋{민첩}＋｛격투｝　{name}의 격투！
//민첩=10+{민첩A}
//민첩A=10
//격투＝１`);
    palette.initialize();
    this.appendChild(palette);

    let standList = new StandList('StandList_' + this.identifier);
    standList.initialize();
    this.appendChild(standList);
  }
}
