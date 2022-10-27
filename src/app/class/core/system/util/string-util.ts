export namespace StringUtil {

  const EMOJI_REGEXP = new RegExp([
    '\ud83c[\udf00-\udfff]',
    '\ud83d[\udc00-\ude4f]',
    '\ud83d[\ude80-\udeff]',
    '\ud7c9[\ude00-\udeff]',
    '[\u2600-\u27BF]'
  ].join('|'));

  export function toHalfWidth(str: String): string {
    return str.replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  }

  export function isEmote(str: string): boolean {
    if (!str) return false;
    str = this.cr(str).replace(/[\s\r\n]/g, '');
    return Array.from(str).length <= 3 && !/[「」]/.test(str) && (EMOJI_REGEXP.test(str) || /[$＄\\￥！？❕❢‽‼/!/?♥♪♬♩♫☺🤮❤️☠️]/.test(str)); 
  }

  export function cr(str: string): string {
    if (!str) return '';
    let ret = '';
    let flg = '';
    [...str].forEach(c => {
      if (flg) {
        switch (c) {
          case 'n':
          case 'ｎ':
            ret += "\n";
            break;
          case '\\':
          case '￥':
            ret += c;
            break;
          default:
            ret += (flg + c);
        }
        flg = '';
      } else if (c == '\\' || c == '￥') {
        flg = c;
      } else {
        ret += c;
      }
    });
    return ret;
  }

  export function validUrl(url: string): boolean {
    if (!url) return false;
    try {
      new URL(url.trim());
    } catch (e) {
      return false;
    }
    return /^https?\:\/\//.test(url.trim());
  }

  export function sameOrigin(url: string): boolean {
    if (!url) return false;
    try {
      return (new URL(url)).origin === window.location.origin;
    } catch (e) {
      return false;
    }
  }

  export function escapeHtml(str) {
    if(typeof str !== 'string') {
      str = str.toString();
    }
    return str.replace(/[&'`"<>]/g, function(match){
      return {
        '&': '&amp;',
        "'": '&#x27;',
        '`': '&#x60;',
        '"': '&quot;',
        '<': '&lt;',
        '>': '&gt;',
      }[match]
    });
  }

  export function rubyToHtml(str) {
    if(typeof str !== 'string') {
      str = str.toString();
    }
    return str.replace(/[\|｜]([^\|｜\s]+?)《(.+?)》/g, '<ruby>$1<rp>(</rp><rt>$2</rt><rp>)</rp></ruby>');
  }
  
  export function rubyToText(str) {
    if(typeof str !== 'string') {
      str = str.toString();
    }
    return str.replace(/[\|｜]([^\|｜\s]+?)《(.+?)》/g, '$1($2)');
  }

  export function aliasNameToClassName(aliasName: string) {
    switch(aliasName) {
      case 'character':
        return '캐릭터';
      case 'cut-in':
        return '컷인';
      case 'dice-roll-table':
        return '다이스봇 표';
      case 'terrain':
        return '지형';
      case 'table-mask':
        return '맵 마스크';
      case 'text-note':
        return '공유 메모';
      case 'card':
        return '카드';
      case 'dice-symbol':
        return '다이스심볼';
      case 'card-stack':
        return '카드 더미';
      case 'game-table':
        return '테이블';
      case 'chat-tab':
        return '채팅 탭';
      default:
       return aliasName;
    }
  }
}
