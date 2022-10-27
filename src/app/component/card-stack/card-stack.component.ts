import { animate, keyframes, state, style, transition, trigger } from '@angular/animations';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Card } from '@udonarium/card';
import { CardStack } from '@udonarium/card-stack';
import { ImageFile } from '@udonarium/core/file-storage/image-file';
import { ObjectNode } from '@udonarium/core/synchronize-object/object-node';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { EventSystem, Network } from '@udonarium/core/system';
import { StringUtil } from '@udonarium/core/system/util/string-util';
import { PeerCursor } from '@udonarium/peer-cursor';
import { PresetSound, SoundEffect } from '@udonarium/sound-effect';
import { CardStackListComponent } from 'component/card-stack-list/card-stack-list.component';
import { GameCharacterSheetComponent } from 'component/game-character-sheet/game-character-sheet.component';
import { OpenUrlComponent } from 'component/open-url/open-url.component';
import { InputHandler } from 'directive/input-handler';
import { MovableOption } from 'directive/movable.directive';
import { RotableOption } from 'directive/rotable.directive';
import { ContextMenuSeparator, ContextMenuService } from 'service/context-menu.service';
import { ImageService } from 'service/image.service';
import { PanelOption, PanelService } from 'service/panel.service';
import { PointerDeviceService } from 'service/pointer-device.service';
import { ModalService } from 'service/modal.service';
import { ChatMessageService } from 'service/chat-message.service';

@Component({
  selector: 'card-stack',
  templateUrl: './card-stack.component.html',
  styleUrls: ['./card-stack.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('shuffle', [
      state('active', style({ transform: '' })),
      transition('* => active', [
        animate('800ms ease', keyframes([
          style({ transform: 'scale3d(0, 0, 0) rotateZ(0deg)', offset: 0 }),
          style({ transform: 'scale3d(1.2, 1.2, 1.2) rotateZ(360deg)', offset: 0.5 }),
          style({ transform: 'scale3d(0.75, 0.75, 0.75) rotateZ(520deg)', offset: 0.75 }),
          style({ transform: 'scale3d(1.125, 1.125, 1.125) rotateZ(630deg)', offset: 0.875 }),
          style({ transform: 'scale3d(1.0, 1.0, 1.0) rotateZ(720deg)', offset: 1.0 })
        ]))
      ]),
      transition('* => inverse', [
        animate('200ms ease', keyframes([
          style({ transform: 'scale3d(1.0, 1.0, 1.0)', offset: 0 }),
          style({ transform: 'scale3d(0.6, 1.2, 1.2)', offset: 0.5 }),
          style({ transform: 'scale3d(0, 0.75, 0.75)', offset: 0.75 }),
          style({ transform: 'scale3d(0.5, 1.125, 1.125)', offset: 0.875 }),
          style({ transform: 'scale3d(1.0, 1.0, 1.0)', offset: 1.0 })
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
  ]
})
export class CardStackComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() cardStack: CardStack = null;
  @Input() is3D: boolean = false;

  get name(): string { return this.cardStack.name; }
  get rotate(): number { return this.cardStack.rotate; }
  set rotate(rotate: number) { this.cardStack.rotate = rotate; }
  get zindex(): number { return this.cardStack.zindex; }
  get isShowTotal(): boolean { return this.cardStack.isShowTotal; }
  get cards(): Card[] { return this.cardStack.cards; }
  get isEmpty(): boolean { return this.cardStack.isEmpty; }
  get size(): number {
    let card = this.cardStack.topCard;
    return (card ? card.size : 2);
  }

  get hasOwner(): boolean { return this.cardStack.hasOwner; }
  get ownerName(): string { return this.cardStack.ownerName; }
  get ownerColor(): string { return this.cardStack.ownerColor; }

  get topCard(): Card { return this.cardStack.topCard; }
  get imageFile(): ImageFile { return this.imageService.getSkeletonOr(this.cardStack.imageFile); }

  animeState: string = 'inactive';

  private iconHiddenTimer: NodeJS.Timer = null;
  get isIconHidden(): boolean { return this.iconHiddenTimer != null };

  get rubiedText(): string { return StringUtil.rubyToHtml(StringUtil.escapeHtml(this.topCard.text)) }

  get isLocked(): boolean { return this.cardStack ? this.cardStack.isLocked : false; }
  set isLocked(isLocked: boolean) { if (this.cardStack) this.cardStack.isLocked = isLocked; }

  gridSize: number = 50;

  movableOption: MovableOption = {};
  rotableOption: RotableOption = {};

  viewRotateZ = 10;

  get isInverse(): boolean {
    const rotate = Math.abs(this.viewRotateZ + this.rotate) % 360;
    return 90 < rotate && rotate < 270
  }
  
  private doubleClickTimer: NodeJS.Timer = null;
  private doubleClickPoint = { x: 0, y: 0 };

  private input: InputHandler = null;

  constructor(
    private ngZone: NgZone,
    private contextMenuService: ContextMenuService,
    private panelService: PanelService,
    private elementRef: ElementRef<HTMLElement>,
    private changeDetector: ChangeDetectorRef,
    private imageService: ImageService,
    private pointerDeviceService: PointerDeviceService,
    private modalService: ModalService,
    private chatMessageService: ChatMessageService
  ) { }

  ngOnInit() {
    EventSystem.register(this)
      .on('SHUFFLE_CARD_STACK', -1000, event => {
        if (event.data.identifier === this.cardStack.identifier) {
          this.animeState = 'active';
          this.changeDetector.markForCheck();
        }
      })
      .on('INVERSE_CARD_STACK', -1000, event => {
        if (event.data.identifier === this.cardStack.identifier) {
          this.animeState = 'inverse';
          this.changeDetector.markForCheck();
        }
      })
      .on('UPDATE_GAME_OBJECT', -1000, event => {
        let object = ObjectStore.instance.get(event.data.identifier);
        if (!this.cardStack || !object) return;
        if ((this.cardStack === object)
          || (object instanceof ObjectNode && this.cardStack.contains(object))
          || (object instanceof PeerCursor && object.userId === this.cardStack.owner)) {
          this.changeDetector.markForCheck();
        }
      })
      .on<object>('TABLE_VIEW_ROTATE', -1000, event => {
        this.ngZone.run(() => {
          this.viewRotateZ = event.data['z'];
          this.changeDetector.markForCheck();
        });
      })
      .on('CARD_STACK_DECREASED', event => {
        if (event.data.cardStackIdentifier === this.cardStack.identifier && this.cardStack) this.changeDetector.markForCheck();
      })
      .on('SYNCHRONIZE_FILE_LIST', event => {
        this.changeDetector.markForCheck();
      })
      .on('UPDATE_FILE_RESOURE', -1000, event => {
        this.changeDetector.markForCheck();
      })
      .on('DISCONNECT_PEER', event => {
        let cursor = PeerCursor.findByPeerId(event.data.peerId);
        if (!cursor || this.cardStack.owner === cursor.userId) this.changeDetector.markForCheck();
      });
    this.movableOption = {
      tabletopObject: this.cardStack,
      transformCssOffset: 'translateZ(0.15px)',
      colideLayers: ['terrain', 'text-note']
    };
    this.rotableOption = {
      tabletopObject: this.cardStack
    };
  }

  ngAfterViewInit() {
    this.ngZone.runOutsideAngular(() => {
      this.input = new InputHandler(this.elementRef.nativeElement);
    });
    this.input.onStart = e => this.ngZone.run(() => this.onInputStart(e));
  }

  ngOnDestroy() {
    this.input.destroy();
    EventSystem.unregister(this);
  }

  animationShuffleStarted(event: any) {

  }

  animationShuffleDone(event: any) {
    this.animeState = 'inactive';
    this.changeDetector.markForCheck();
  }

  @HostListener('carddrop', ['$event'])
  onCardDrop(e) {
    if (this.cardStack === e.detail || (e.detail instanceof Card === false && e.detail instanceof CardStack === false)) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();

    if (e.detail instanceof Card) {
      let card: Card = e.detail;
      let distance: number = (card.location.x - this.cardStack.location.x) ** 2 + (card.location.y - this.cardStack.location.y) ** 2 + (card.posZ - this.cardStack.posZ) ** 2;
      if (distance < 50 ** 2) {
        this.chatMessageService.sendOperationLog(`${card.isFront ? (card.name == '' ? '(이름없는 카드)' : card.name) : '엎어둔 카드'} 를 ${this.cardStack.name == '' ? '(이름없는 카드 더미)' : this.cardStack.name} 에 올렸다`);
        this.cardStack.putOnTop(card);
      }
    } else if (e.detail instanceof CardStack) {
      let cardStack: CardStack = e.detail;
      let distance: number = (cardStack.location.x - this.cardStack.location.x) ** 2 + (cardStack.location.y - this.cardStack.location.y) ** 2 + (cardStack.posZ - this.cardStack.posZ) ** 2;
      if (distance < 25 ** 2) {
        this.chatMessageService.sendOperationLog(`${cardStack.name == '' ? '(이름없는 카드 더미)' : cardStack.name} 를 전부 ${this.cardStack.name == '' ? '(이름없는 카드 더미)' : this.cardStack.name} 에 올렸다`);
        this.concatStack(cardStack);
      }
    }
  }

  startDoubleClickTimer(e) {
    if (!this.doubleClickTimer) {
      this.stopDoubleClickTimer();
      this.doubleClickTimer = setTimeout(() => this.stopDoubleClickTimer(), e.touches ? 500 : 300);
      this.doubleClickPoint = this.input.pointer;
      return;
    }

    if (e.touches) {
      this.input.onEnd = this.onDoubleClick.bind(this);
    } else {
      this.onDoubleClick();
    }
  }

  stopDoubleClickTimer() {
    clearTimeout(this.doubleClickTimer);
    this.doubleClickTimer = null;
    this.input.onEnd = null;
  }

  onDoubleClick() {
    this.stopDoubleClickTimer();
    let distance = (this.doubleClickPoint.x - this.input.pointer.x) ** 2 + (this.doubleClickPoint.y - this.input.pointer.y) ** 2;
    if (distance < 10 ** 2) {
      console.log('onDoubleClick !!!!');

      const card = this.drawCard();
      if (card) {
        SoundEffect.play(PresetSound.cardDraw);
        let text: string;
        if (card.isFront) {
          text = `${this.cardStack.name == '' ? '(이름없는 카드 더미)' : this.cardStack.name} 로부터 ${card.name == '' ? '(이름없는 카드)' : card.name} 를 뽑았다`
        } else {
          text = `${this.cardStack.name == '' ? '(이름없는 카드 더미)' : this.cardStack.name} 로부터 1장 뽑아서 엎었다`
        }
        this.chatMessageService.sendOperationLog(text);
      }
    }
  }

  @HostListener('dragstart', ['$event'])
  onDragstart(e) {
    e.stopPropagation();
    e.preventDefault();
  }

  onInputStart(e: MouseEvent | TouchEvent) {
    this.startDoubleClickTimer(e);
    this.cardStack.toTopmost();
    this.startIconHiddenTimer();

    // TODO:もっと良い方法考える
    if (this.isLocked) {
      EventSystem.trigger('DRAG_LOCKED_OBJECT', {});
    }

    EventSystem.trigger('SELECT_TABLETOP_OBJECT', { identifier: this.cardStack.identifier, className: 'GameCharacter' });
  }

  @HostListener('contextmenu', ['$event'])
  onContextMenu(e: Event) {
    e.stopPropagation();
    e.preventDefault();

    if (!this.pointerDeviceService.isAllowedToOpenContextMenu) return;
    let position = this.pointerDeviceService.pointers[0];
    this.contextMenuService.open(position, [
      (this.isLocked
        ? {
          name: '☑ 고정', action: () => {
            this.isLocked = false;
            SoundEffect.play(PresetSound.unlock);
          }
        } : {
          name: '☐ 고정', action: () => {
            this.isLocked = true;
            SoundEffect.play(PresetSound.lock);
          }
        }),
      ContextMenuSeparator,
      {
        name: '카드를 １장 뽑는다', action: () => {
          const card = this.drawCard();
          if (card) {
            SoundEffect.play(PresetSound.cardDraw);
            let text: string;
            if (card.isFront) {
              text = `${this.cardStack.name} 로부터 ${card.name == '' ? '(이름없는 카드)' : card.name} 를 뽑았다`
            } else {
              text = `${this.cardStack.name} 로부터 1장 뽑아서 엎었다`
            }
            this.chatMessageService.sendOperationLog(text);
          }
        },
        default: this.cards.length > 0,
        disabled: this.cards.length == 0
      },
      {
        name: '카드를 뽑는다', action: null,
        subActions: [2, 3, 4, 5, 10].map(n => {
          return {
            name: `${n}장`,
            action: () => {
              const cards: Card[] = [];
              for (let i = 0; i < n; i++) {
                const card = this.drawCard();
                if (card) {
                  cards.push(card);
                  if (i == 0 || i == 3 || i == 9) SoundEffect.play(PresetSound.cardDraw);
                }
              }
              if (cards.length > 0) {
                const frontCards = cards.filter(card => card.isFront);
                if (frontCards.length == 0) {
                  this.chatMessageService.sendOperationLog(`${this.cardStack.name == '' ? '(이름없는 카드 더미)' : this.cardStack.name} 로부터 ${cards.length}장 뽑아서 엎었다`);
                } else {
                  const counter = new Map();
                  for (const card of frontCards) {
                    let count = counter.get(card.name) || 0;
                    count += 1;
                    counter.set(card.name == '' ? '(이름없는 카드)' : card.name, count);
                  }
                  let text = `${this.cardStack.name == '' ? '(이름없는 카드 더미)' : this.cardStack.name} 로부터 ${[...counter.keys()].map(key => `${key} 를 ${counter.get(key)}장`).join('、')}`;
                  if (frontCards.length === cards.length) {
                    text += '뽑았다'
                  } else {
                    text += `뽑고, ${cards.length - frontCards.length}장 뽑아서 엎었다`;
                  }
                  this.chatMessageService.sendOperationLog(text);
                }
              }
            }
          };
        }),
        disabled: this.cards.length == 0
      },
      ContextMenuSeparator,
      (this.cards.length == 0 || !this.cardStack.topCard.isFront ? {
        name: '가장 위를 앞면으로 한다', action: () => {
          if (!this.cardStack.topCard) return;
          if (!this.cardStack.topCard.isFront) this.chatMessageService.sendOperationLog(`${this.cardStack.name == '' ? '(이름없는 카드 더미)' : this.cardStack.name} 의 가장 위에 있는 ${this.cardStack.topCard.name == '' ? '(이름없는 카드)' : this.cardStack.topCard.name} 를 공개했다`);
          this.cardStack.faceUp();
          SoundEffect.play(PresetSound.cardDraw);
        }, 
        disabled: this.cards.length == 0        
      } : {
        name: '가장 위를 뒷면으로 한다', action: () => {
          this.cardStack.faceDown();
          SoundEffect.play(PresetSound.cardDraw);
        }, 
        disabled: this.cards.length == 0
      }),
      ContextMenuSeparator,
      {
        name: '전부 앞면으로 한다', action: () => {
          //if (!this.cardStack.topCard) return;
          //if (!this.cardStack.topCard.isFront) this.chatMessageService.sendOperationLog(`${this.cardStack.name} 를 전부 앞면으로 하고, 가장 위의 ${this.cardStack.topCard.name} 를 공개했다`);
          this.cardStack.faceUpAll();
          SoundEffect.play(PresetSound.cardDraw);
        }, 
        disabled: this.cards.length == 0
      },
      {
        name: '전부 뒷면으로 한다', action: () => {
          this.cardStack.faceDownAll();
          SoundEffect.play(PresetSound.cardDraw);
        }, 
        disabled: this.cards.length == 0
      },
      {
        name: '전부 정방향으로 한다', action: () => {
          this.cardStack.uprightAll();
          SoundEffect.play(PresetSound.cardDraw);
        }, 
        disabled: this.cards.length == 0
      },
      ContextMenuSeparator,
      {
        name: '섞는다', action: () => {
          this.cardStack.shuffle();
          SoundEffect.play(PresetSound.cardShuffle);
          EventSystem.call('SHUFFLE_CARD_STACK', { identifier: this.cardStack.identifier });
        }, 
        disabled: this.cards.length == 0
      },
      { name: '카드 리스트를 본다', action: () => {
        this.showStackList(this.cardStack);
        this.chatMessageService.sendOperationLog(`${this.cardStack.name == '' ? '(이름없는 카드 더미)' : this.cardStack.name} 의 카드 리스트를 보았다`);
      }, disabled: this.cards.length == 0 },
      ContextMenuSeparator,
      (this.isShowTotal
        ? { name: '☑ 장수를 표시', action: () => { this.cardStack.isShowTotal = false; } }
        : { name: '☐ 장수를 표시', action: () => { this.cardStack.isShowTotal = true; } }
      ),
      { name: '카드 사이즈를 맞춘다', action: () => { if (this.cardStack.topCard) this.cardStack.unifyCardsSize(this.cardStack.topCard.size); }, disabled: this.cards.length == 0 },
      ContextMenuSeparator,
      {
        name: '카드 더미를 분할한다', 
        subActions: [
          {
            name: '사람 수대로 분할',
            action: () => {
              this.splitStack(Network.peerIds.length);
              SoundEffect.play(PresetSound.cardDraw);
            }
          },
          ContextMenuSeparator,
          ...[2, 3, 4, 5, 6].map(num => {
            return {
              name: `${num}개로 분할`,
              action: () => {
                this.splitStack(num);
                SoundEffect.play(PresetSound.cardDraw);
              }
            }
          })
        ],
        disabled: this.cards.length == 0
      },
      {
        name: '카드 더미를 부순다', action: () => {
          this.breakStack();
          SoundEffect.play(PresetSound.cardShuffle);
        }, 
        disabled: this.cards.length == 0
      },
      {
        name: '카드 더미 전체를 뒤집는다', action: () => {
          this.cardStack.inverse();
          SoundEffect.play(PresetSound.cardDraw);
          SoundEffect.play(PresetSound.cardDraw);
          EventSystem.call('INVERSE_CARD_STACK', { identifier: this.cardStack.identifier });
        }, 
        disabled: this.cards.length == 0
      },
      ContextMenuSeparator,
      { name: '상세를 표시', action: () => { this.showDetail(this.cardStack); } },
      (this.cardStack.getUrls().length <= 0 ? null : {
        name: '참조URL을 연다', action: null,
        subActions: this.cardStack.getUrls().map((urlElement) => {
          const url = urlElement.value.toString();
          return {
            name: urlElement.name ? urlElement.name : url,
            action: () => {
              if (StringUtil.sameOrigin(url)) {
                window.open(url.trim(), '_blank', 'noopener');
              } else {
                this.modalService.open(OpenUrlComponent, { url: url, title: this.cardStack.name, subTitle: urlElement.name });
              } 
            },
            disabled: !StringUtil.validUrl(url),
            error: !StringUtil.validUrl(url) ? 'URL이 정확하지 않습니다.' : null,
            isOuterLink: StringUtil.validUrl(url) && !StringUtil.sameOrigin(url)
          };
        })
      }),
      (this.cardStack.getUrls().length <= 0 ? null : ContextMenuSeparator),
      {
        name: '사본을 작성', action: () => {
          let cloneObject = this.cardStack.clone();
          cloneObject.location.x += this.gridSize;
          cloneObject.location.y += this.gridSize;
          cloneObject.owner = '';
          cloneObject.isLocked = false;
          cloneObject.toTopmost();
          SoundEffect.play(PresetSound.cardPut);
        }
      },
      {
        name: '카드 더미를 삭제', action: () => {
          this.cardStack.setLocation('graveyard');
          this.cardStack.destroy();
          SoundEffect.play(PresetSound.sweep);
        }
      },
    ], this.name);
  }

  onMove() {
    SoundEffect.play(PresetSound.cardPick);
  }

  onMoved() {
    SoundEffect.play(PresetSound.cardPut);
    this.ngZone.run(() => this.dispatchCardDropEvent());
  }

  private drawCard(): Card {
    let card = this.cardStack.drawCard();
    if (card) {
      this.cardStack.update(); // todo
      card.location.x += 100 + (Math.random() * 50);
      card.location.y += 25 + (Math.random() * 50);
      card.setLocation(this.cardStack.location.name);
    }
    return card;
  }

  private breakStack() {
    let cards = this.cardStack.drawCardAll().reverse();
    for (let card of cards) {
      card.location.x += 25 - (Math.random() * 50);
      card.location.y += 25 - (Math.random() * 50);
      card.toTopmost();
      card.setLocation(this.cardStack.location.name);
    }
    this.cardStack.setLocation('graveyard');
    this.cardStack.destroy();
  }

  private splitStack(split: number) {
    if (split < 2) return;
    let cardStacks: CardStack[] = [];
    for (let i = 0; i < split; i++) {
      let cardStack = CardStack.create(`${this.cardStack.name}_${('0' + (i+1).toString()).slice(-2)}`);
      cardStack.location.x = this.cardStack.location.x + 50 - (Math.random() * 100);
      cardStack.location.y = this.cardStack.location.y + 50 - (Math.random() * 100);
      cardStack.posZ = this.cardStack.posZ;
      cardStack.location.name = this.cardStack.location.name;
      cardStack.rotate = this.rotate;
      cardStack.toTopmost();
      cardStacks.push(cardStack);
    }

    let cards = this.cardStack.drawCardAll();
    this.cardStack.setLocation('graveyard');
    this.cardStack.destroy();

    let num = 0;
    let splitIndex = (cards.length / split) * (num + 1);
    for (let i = 0; i < cards.length; i++) {
      cardStacks[num].putOnBottom(cards[i]);
      if (splitIndex <= i + 1) {
        num++;
        splitIndex = (cards.length / split) * (num + 1);
      }
    }
  }

  private concatStack(topStack: CardStack, bottomStack: CardStack = this.cardStack) {
    let newCardStack = CardStack.create(bottomStack.name);
    newCardStack.location.name = bottomStack.location.name;
    newCardStack.location.x = bottomStack.location.x;
    newCardStack.location.y = bottomStack.location.y;
    newCardStack.posZ = bottomStack.posZ;
    newCardStack.zindex = topStack.zindex;
    newCardStack.rotate = bottomStack.rotate;

    let bottomCards: Card[] = bottomStack.drawCardAll();
    let topCards: Card[] = topStack.drawCardAll();
    for (let card of topCards.concat(bottomCards)) newCardStack.putOnBottom(card);

    bottomStack.setLocation('');
    bottomStack.destroy();

    topStack.setLocation('');
    topStack.destroy();
  }

  private dispatchCardDropEvent() {
    let element: HTMLElement = this.elementRef.nativeElement;
    let parent = element.parentElement;
    let children = parent.children;
    let event = new CustomEvent('carddrop', { detail: this.cardStack, bubbles: true });
    for (let i = 0; i < children.length; i++) {
      children[i].dispatchEvent(event);
    }
  }

  private showDetail(gameObject: CardStack) {
    EventSystem.trigger('SELECT_TABLETOP_OBJECT', { identifier: gameObject.identifier, className: gameObject.aliasName });
    let coordinate = this.pointerDeviceService.pointers[0];
    let title = '카드 더미 설정';
    if (gameObject.name.length) title += ' - ' + gameObject.name;
    let option: PanelOption = { title: title, left: coordinate.x - 300, top: coordinate.y - 300, width: 600, height: 490 };
    let component = this.panelService.open<GameCharacterSheetComponent>(GameCharacterSheetComponent, option);
    component.tabletopObject = gameObject;
  }

  private showStackList(gameObject: CardStack) {
    EventSystem.trigger('SELECT_TABLETOP_OBJECT', { identifier: gameObject.identifier, className: gameObject.aliasName });

    let coordinate = this.pointerDeviceService.pointers[0];
    let option: PanelOption = { left: coordinate.x - 200, top: coordinate.y - 300, width: 400, height: 600 };

    this.cardStack.owner = Network.peerContext.userId;
    let component = this.panelService.open<CardStackListComponent>(CardStackListComponent, option);
    component.cardStack = gameObject;
  }

  private startIconHiddenTimer() {
    clearTimeout(this.iconHiddenTimer);
    this.iconHiddenTimer = setTimeout(() => {
      this.iconHiddenTimer = null;
      this.changeDetector.markForCheck();
    }, 300);
    this.changeDetector.markForCheck();
  }
}
