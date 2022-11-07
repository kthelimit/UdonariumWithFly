import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ObjectSerializer } from '@udonarium/core/synchronize-object/object-serializer';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { EventSystem } from '@udonarium/core/system';
import { DiceRollTable } from '@udonarium/dice-roll-table';
import { DiceRollTableList } from '@udonarium/dice-roll-table-list';
import { TextViewComponent } from 'component/text-view/text-view.component';
import { ModalService } from 'service/modal.service';
import { PanelOption, PanelService } from 'service/panel.service';
import { PointerDeviceService } from 'service/pointer-device.service';
import { SaveDataService } from 'service/save-data.service';

@Component({
  selector: 'dice-roll-table-setting',
  templateUrl: './dice-roll-table-setting.component.html',
  styleUrls: ['./dice-roll-table-setting.component.css']
})
export class DiceRollTableSettingComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('diceRollTableSelecter') diceRollTableSelecter: ElementRef<HTMLSelectElement>;

  selectedDiceRollTable: DiceRollTable = null;
  selectedDiceRollTableXml: string = '';

  get diceRollTableName(): string { return this.selectedDiceRollTable.name; }
  set diceRollTableName(name: string) { if (this.isEditable) this.selectedDiceRollTable.name = name; }

  get diceRollTableDice(): string { return this.selectedDiceRollTable.dice; }
  set diceRollTableDice(dice: string) { if (this.isEditable) this.selectedDiceRollTable.dice = dice; }

  get diceRollTableCommand(): string { return this.selectedDiceRollTable.command; }
  set diceRollTableCommand(command: string) { if (this.isEditable) this.selectedDiceRollTable.command = command; }

  get diceRollTableText(): string { return <string>this.selectedDiceRollTable.value; }
  set diceRollTableText(text: string) { if (this.isEditable) this.selectedDiceRollTable.value = text; }

  get diceRollTables(): DiceRollTable[] { return DiceRollTableList.instance.children as DiceRollTable[]; }
  get isEmpty(): boolean { return this.diceRollTables.length < 1 }
  get isDeleted(): boolean { return this.selectedDiceRollTable ? ObjectStore.instance.get(this.selectedDiceRollTable.identifier) == null : false; }
  get isEditable(): boolean { return !this.isEmpty && !this.isDeleted; }

  isSaveing: boolean = false;
  progresPercent: number = 0;

  constructor(
    private pointerDeviceService: PointerDeviceService,
    private modalService: ModalService,
    private panelService: PanelService,
    private saveDataService: SaveDataService
  ) { }

  ngOnInit() {
    Promise.resolve().then(() => this.modalService.title = this.panelService.title = '다이스봇 표 ');
    EventSystem.register(this)
      .on('DELETE_GAME_OBJECT', 1000, event => {
        if (!this.selectedDiceRollTable || event.data.identifier !== this.selectedDiceRollTable.identifier) return;
        let object = ObjectStore.instance.get(event.data.identifier);
        if (object !== null) {
          this.selectedDiceRollTableXml = object.toXml();
        }
      });
  }

  ngAfterViewInit() {
    //const diceRollTables = DiceRollTableList.instance.diceRollTables;
    if (this.diceRollTables.length > 0) {
      queueMicrotask(() => {
        this.onChangeDiceRollTable(this.diceRollTables[0].identifier);
        this.diceRollTableSelecter.nativeElement.selectedIndex = 0;
      });
    }
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
  }

  onChangeDiceRollTable(identifier: string) {
    this.selectedDiceRollTable = ObjectStore.instance.get<DiceRollTable>(identifier);
    this.selectedDiceRollTableXml = '';
  }

  create(name: string = '다이스봇 표'): DiceRollTable {
    return DiceRollTableList.instance.addDiceRollTable(name)
  }

  add() {
    const diceRollTable = this.create();
    queueMicrotask(() => {
      this.onChangeDiceRollTable(diceRollTable.identifier);
      this.diceRollTableSelecter.nativeElement.value = diceRollTable.identifier;
    })
  }
  
  async save() {
    if (!this.selectedDiceRollTable || this.isSaveing) return;
    this.isSaveing = true;
    this.progresPercent = 0;

    let fileName: string = 'fly_rollTable_' + this.selectedDiceRollTable.name;

    await this.saveDataService.saveGameObjectAsync(this.selectedDiceRollTable, fileName, percent => {
      this.progresPercent = percent;
    });

    setTimeout(() => {
      this.isSaveing = false;
      this.progresPercent = 0;
    }, 500);
  }

  async saveAll() {
    if (this.isSaveing) return;
    this.isSaveing = true;
    this.progresPercent = 0;

    await this.saveDataService.saveGameObjectAsync(DiceRollTableList.instance, 'fly_rollTable_All', percent => {
      this.progresPercent = percent;
    });

    setTimeout(() => {
      this.isSaveing = false;
      this.progresPercent = 0;
    }, 500);
  }

  delete() {
    if (!this.isEmpty && this.selectedDiceRollTable) {
      this.selectedDiceRollTableXml = this.selectedDiceRollTable.toXml();
      this.selectedDiceRollTable.destroy();
    }
  }

  restore() {
    if (this.selectedDiceRollTable && this.selectedDiceRollTableXml) {
      let restoreTable = <DiceRollTable>ObjectSerializer.instance.parseXml(this.selectedDiceRollTableXml);
      DiceRollTableList.instance.addDiceRollTable(restoreTable);
      this.selectedDiceRollTableXml = '';
      queueMicrotask(() => {
        const diceRollTables = this.diceRollTables;
        this.onChangeDiceRollTable(diceRollTables[diceRollTables.length - 1].identifier);
        this.diceRollTableSelecter.nativeElement.selectedIndex = diceRollTables.length - 1;
      });
    }
  }

  upTabIndex() {
    if (!this.selectedDiceRollTable) return;
    let parentElement = this.selectedDiceRollTable.parent;
    let index: number = parentElement.children.indexOf(this.selectedDiceRollTable);
    if (0 < index) {
      let prevElement = parentElement.children[index - 1];
      parentElement.insertBefore(this.selectedDiceRollTable, prevElement);
    }
  }

  downTabIndex() {
    if (!this.selectedDiceRollTable) return;
    let parentElement = this.selectedDiceRollTable.parent;
    let index: number = parentElement.children.indexOf(this.selectedDiceRollTable);
    if (index < parentElement.children.length - 1) {
      let nextElement = parentElement.children[index + 1];
      parentElement.insertBefore(nextElement, this.selectedDiceRollTable);
    }
  }

  helpDiceRollTable() {
    let coordinate = this.pointerDeviceService.pointers[0];
    let option: PanelOption = { left: coordinate.x, top: coordinate.y, width: 600, height: 788 };
    let textView = this.panelService.open(TextViewComponent, option);
    textView.title = '다이스봇 표 도움말';
    textView.text = 
`　이름, 명령어, 굴릴 다이스를 설정하고 나온 다이스 숫자로 표를 참조해 표시합니다.
　채팅으로 커맨드를 송신하는 것으로 다이스봇과 같은 결과가 송신됩니다.
　표는 1행마다 숫자와 결과를:(콜론)로 구분해 「숫자:결과」의 형태로 작성합니다(따라서, 다이스는 마지막에 숫자 하나를 반환하는 것일 필요가 있습니다. 제각각의 주사위 nBm、조건 만족시 추가 굴림 다이스 nRm、상향 무한 롤 nUm 의 성공수에도 대응하고 있습니다).
　
　-(하이픈) 또는 ~로 구분하여 숫자범위를 지정할 수도 있습니다.
　표에 \\n 이라고 쓰면 거기서 줄을 바꿉니다(\\n은 표시되지 않습니다).

다이스봇 표의 예）
　name: 조우함종　
　command: ShipType　　dice: 1d6

　　1:전함
　　2:항공모함
　　3:중순양함
　　4:경순양함
　　5-6:구축함
  
　표를 참조할 때는 앞에 있는 내용을 우선합니다, 위의 예에서는 마지막 행을 「1-6:구축함」으로 해도 같은 결과가 됩니다(그렇지만 알기 쉽게 쓰는 것을 권장합니다).
　디폴트인 D66은 정렬되지 않습니다. 정렬된 숫자가 필요한 경우(사이코로 픽션의 이름표 등으로)에는 D66S를 사용해주세요. 
  숫자를 작성할 때 *(아스터리스크)를 와일드카드(임의의 숫자)로서 사용할 수 있습니다. 예를 들어 *-1*라고 하면 1이하, 6-*라고 쓰면 6이상인 임의의 숫자입니다.(*단독은 모든 숫자가 되어 앞의 것으로부터 참조되므로 다이스봇표의 중간 행에 쓴 경우, 그보다 앞선 행이 참조되지 않게 됩니다.) 다음에 적는 수정을 통해 표에서 벗어나도 결과를 얻을 수 있도록 할 수 있씁니다.  
　
 채팅으로 커맨드를 입력 할 때 반각전각, 알파벳 대문자 소문자는 무시됩니다. 또한 다이스에 수정을 더하거나 임의의 숫자로 참조할 수 있습니다. 명령어 후에 +수정치 또는 -수정치를 적는 것으로 굴린 다이스의 숫자를 수정합니다. 또 =지정치라고 적는 것으로 그 숫자로 커맨드에 대응하는 다이스봇표를 참조합니다. 수정치, 지정치는 임의의 정수입니다.

커맨드의 예）
　ShipType=3
　전술한 다이스봇 표의 예 「조우함종」을 숫자3 지정으로 참조합니다. 결과 「중순양함」이 됩니다. 만약 1미만이나 6을 넘는 숫자를 지정할 경우, 「(결과없음)」이 될 것입니다.

　ShipType+2
　전술한 다이스봇 표의 예 「조우함종」을 1d6의 결과에 +2한 숫자로 참조합니다. 「조우함종」에는 7이후가 작성되어 있지 않습니다. 그 경우 「(결과없음)」이 될 것입니다. 그것을 피하고 싶은 경우에는 전술한 와일드 카드 *를 사용합니다.`;
  }
}
