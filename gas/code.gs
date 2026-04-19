/**
 * MY SAKE WORLD - Google Apps Script バックエンド
 *
 * ===== デプロイ手順 =====
 * 1. 対象スプレッドシート (ID: 1zvOH6pB2i3NLn0_15IzjrHmDHIJbI2j1dPQ1aA3UYMw) を開く
 * 2. メニュー「拡張機能」→「Apps Script」を開く
 * 3. このコードを全て貼り付けて保存（Ctrl+S）
 * 4. 【初回・スキーマ変更時】関数「initialize」を実行してシートを初期化
 * 5. 「デプロイ」→「新しいデプロイ」→ 種類: ウェブアプリ
 * 6. 実行ユーザー: 自分 / アクセス: 全員 → デプロイ → URLをHTMLファイルに貼り付け
 *
 * ===== 更新時 =====
 * 「デプロイ」→「デプロイを管理」→「編集」→「新しいバージョン」で再デプロイ
 */

// ===== 定数 =====
const SPREADSHEET_ID              = '1zvOH6pB2i3NLn0_15IzjrHmDHIJbI2j1dPQ1aA3UYMw';
const RECIPE_SHEET_NAME           = 'レシピ';
const SAKE_SHEET_NAME             = '酒リスト';
const SETTINGS_SHEET_NAME         = '設定';
const ADDITIONAL_ORDER_SHEET_NAME = '追加注文';

// ShopifyのURL
const SHOPIFY_URL = 'https://assemblageclub.myshopify.com/collections/all';

// ===== JSONレスポンス生成 =====
function createJsonResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ===== GETリクエスト処理 =====
function doGet(e) {
  const action = e.parameter.action;
  const role   = e.parameter.role;
  try {
    switch (action) {
      case 'getSakeList':         return createJsonResponse(getSakeList());
      case 'getOrders':           return createJsonResponse(getOrders(role));
      case 'getFormSettings':     return createJsonResponse(getFormSettings());
      case 'getBlenderIdCounter': return createJsonResponse(getBlenderIdCounter());
      default: return createJsonResponse({ error: '不明なアクション: ' + action });
    }
  } catch (err) {
    return createJsonResponse({ error: err.toString() });
  }
}

// ===== POSTリクエスト処理 =====
function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return createJsonResponse({ error: 'JSONパースエラー: ' + err.toString() });
  }
  try {
    switch (data.action) {
      case 'submitRecipe':           return createJsonResponse(submitRecipe(data));
      case 'submitAdditionalOrder':  return createJsonResponse(submitAdditionalOrder(data));
      case 'addSake':                return createJsonResponse(addSake(data.name));
      case 'deleteSake':             return createJsonResponse(deleteSake(data.name));
      case 'updateStatus':           return createJsonResponse(updateStatus(data.id));
      case 'updateFormSettings':     return createJsonResponse(updateFormSettings(data));
      case 'updateBlenderIdCounter': return createJsonResponse(updateBlenderIdCounter(data));
      default: return createJsonResponse({ error: '不明なアクション: ' + data.action });
    }
  } catch (err) {
    return createJsonResponse({ error: err.toString() });
  }
}

// ===== 酒リスト取得 =====
function getSakeList() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SAKE_SHEET_NAME);
  if (!sheet) return { list: [] };
  const lastRow = sheet.getLastRow();
  if (lastRow === 0) return { list: [] };
  const values = sheet.getRange(1, 1, lastRow, 1).getValues();
  return { list: values.map(r => r[0]).filter(v => v !== '') };
}

// ===== 注文一覧取得 =====
function getOrders(role) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(RECIPE_SHEET_NAME);
  if (!sheet) return { orders: [] };
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { orders: [] };

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rows    = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

  // 新着を先頭に
  const orders = rows.reverse().map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });

  if (role === 'brewery') {
    // 酒蔵用：個人情報（メール）を除くフィールドのみ返却
    return {
      orders: orders.map(o => ({
        ブレンダーID: o['ブレンダーID'],
        受信日時    : o['受信日時'],
        制作日      : o['制作日'],
        レシピ名    : o['レシピ名'],
        名前        : o['名前'],
        ブレンダー名: o['ブレンダー名'],
        ラベル色    : o['ラベル色'],
        酒1名: o['酒1名'], 酒1ml: o['酒1ml'],
        酒2名: o['酒2名'], 酒2ml: o['酒2ml'],
        酒3名: o['酒3名'], 酒3ml: o['酒3ml'],
        酒4名: o['酒4名'], 酒4ml: o['酒4ml'],
        酒5名: o['酒5名'], 酒5ml: o['酒5ml'],
        酒6名: o['酒6名'], 酒6ml: o['酒6ml'],
        酒7名: o['酒7名'], 酒7ml: o['酒7ml'],
        酒8名: o['酒8名'], 酒8ml: o['酒8ml'],
        確認済み    : o['確認済み']
      }))
    };
  }
  return { orders }; // 管理者用：全カラム
}

// ===== フォーム設定取得 =====
function getFormSettings() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SETTINGS_SHEET_NAME);
  if (!sheet) return getDefaultFormSettings();
  const lastRow = sheet.getLastRow();
  if (lastRow === 0) return getDefaultFormSettings();
  const values   = sheet.getRange(1, 1, lastRow, 2).getValues();
  const settings = {};
  values.forEach(row => { if (row[0]) settings[String(row[0])] = row[1]; });
  return {
    labelOptions: settings['label_options']
      ? String(settings['label_options']).split(',').map(s => s.trim()).filter(s => s)
      : ['白ラベル', '黒ラベル'],
    targetMl : parseInt(settings['target_ml']) || 40,
    maxRows  : parseInt(settings['max_rows'])  || 8,
    guideText: settings['guide_text'] != null && settings['guide_text'] !== ''
      ? String(settings['guide_text'])
      : 'お好みのお酒を組み合わせてオリジナルブレンドを作りましょう'
  };
}

function getDefaultFormSettings() {
  return { labelOptions: ['白ラベル', '黒ラベル'], targetMl: 40, maxRows: 8,
    guideText: 'お好みのお酒を組み合わせてオリジナルブレンドを作りましょう' };
}

// ===== フォーム設定更新（キー単位）=====
function updateFormSettings(data) {
  if (!data.key) throw new Error('設定キーが必要です');
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  let   sheet = ss.getSheetByName(SETTINGS_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SETTINGS_SHEET_NAME);
  const lastRow = sheet.getLastRow();
  let found = false;
  if (lastRow > 0) {
    const keys = sheet.getRange(1, 1, lastRow, 1).getValues();
    for (let i = 0; i < keys.length; i++) {
      if (keys[i][0] === data.key) {
        sheet.getRange(i + 1, 2).setValue(String(data.value));
        found = true; break;
      }
    }
  }
  if (!found) sheet.appendRow([data.key, String(data.value)]);
  return { success: true };
}

// ===== ブレンダーIDカウンター取得 =====
// counter の値を返す（次に発番される番号 = counter + 1）
function getBlenderIdCounter() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SETTINGS_SHEET_NAME);
  if (!sheet) return { counter: 0 };
  const lastRow = sheet.getLastRow();
  if (lastRow === 0) return { counter: 0 };
  const values = sheet.getRange(1, 1, lastRow, 2).getValues();
  for (const row of values) {
    if (row[0] === 'blender_id_counter') return { counter: parseInt(row[1]) || 0 };
  }
  return { counter: 0 };
}

// ===== ブレンダーIDカウンター更新（管理者用）=====
// data.counter に保存したい値を渡す（次の発番 = counter + 1）
function updateBlenderIdCounter(data) {
  if (data.counter === undefined || data.counter === null) throw new Error('counterが必要です');
  const val = parseInt(data.counter);
  if (isNaN(val) || val < 0) throw new Error('0以上の数値を指定してください');
  return updateFormSettings({ key: 'blender_id_counter', value: String(val) });
}

// ===== ブレンダーIDをインクリメントして発番 =====
// 設定シートの blender_id_counter を +1 してその値を返す
function getAndIncrementBlenderId() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  let   sheet = ss.getSheetByName(SETTINGS_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SETTINGS_SHEET_NAME);

  const lastRow  = sheet.getLastRow();
  let foundRow   = -1;
  let currentVal = 0;

  if (lastRow > 0) {
    const values = sheet.getRange(1, 1, lastRow, 2).getValues();
    for (let i = 0; i < values.length; i++) {
      if (values[i][0] === 'blender_id_counter') {
        foundRow   = i + 1;
        currentVal = parseInt(values[i][1]) || 0;
        break;
      }
    }
  }

  const newVal = currentVal + 1;
  if (foundRow > 0) {
    sheet.getRange(foundRow, 2).setValue(newVal);
  } else {
    sheet.appendRow(['blender_id_counter', newVal]);
  }
  return newVal;
}

// ===== レシピ送信 =====
function submitRecipe(data) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(RECIPE_SHEET_NAME);
  if (!sheet) throw new Error('レシピシートが見つかりません');

  // ブレンダーIDを発番（シンプルな連番）
  const blenderId = getAndIncrementBlenderId();
  const now       = new Date();
  const dateStr   = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');

  // 行データ組み立て
  const row = [
    blenderId,
    dateStr,
    data.date        || '',  // 制作日
    data.recipeName  || '',  // レシピ名（Title）
    data.name        || '',  // お名前
    data.blenderName || '',  // Blender名
    data.labelColor  || '',
  ];

  // 最大8種のブレンド（酒名・mlを交互に格納）
  for (let i = 0; i < 8; i++) {
    const b = data.blends && data.blends[i];
    row.push(b ? (b.name || '') : '');
    row.push(b ? (b.ml   || '') : '');
  }

  row.push(data.email || '');
  row.push(''); // 確認済みフラグ（初期値: 空）

  sheet.appendRow(row);

  // 確認メール送信（エラーでもレシピ保存は成功として返す）
  try {
    sendConfirmationEmail(data, blenderId);
  } catch (emailErr) {
    Logger.log('メール送信エラー: ' + emailErr.toString());
  }

  return { success: true, blenderId: blenderId };
}

// ===== 確認メール送信 =====
function sendConfirmationEmail(data, blenderId) {
  if (!data.email) return;

  const now        = new Date();
  const expiryDate = new Date(now);
  expiryDate.setMonth(expiryDate.getMonth() + 6);
  const expiryStr  = Utilities.formatDate(expiryDate, 'Asia/Tokyo', 'yyyy年MM月dd日');
  const displayDate = data.date
    ? data.date.replace(/-/g, '/')
    : Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd');

  // ブレンドレシピを番号付きリストに整形
  let recipeLines = '';
  (data.blends || []).forEach((b, i) => {
    if (b && b.name) recipeLines += `${i + 1}. ${b.name}  ${b.ml}ml\n`;
  });

  const body =
`${data.name || ''}さま

あなたの"My Sake"が登録できました！

こちらからご発注いただけます。
${SHOPIFY_URL}

レシピの保管期限：${expiryStr}まで

価格：200ml / ¥2,000　　720ml / ¥4,900

${data.name || ''}さんのMy Sake Recipe
＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿
制作日：${displayDate}
ブレンダーID：${blenderId}
Blender：${data.blenderName || ''}
Title：${data.recipeName || ''}

Recipe：
${recipeLines}＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿

MY SAKE WORLD`;

  MailApp.sendEmail({
    to     : data.email,
    subject: '【MY SAKE WORLD】あなたのMy Sakeレシピが登録されました',
    body   : body
  });
}

// ===== 追加注文送信 =====
function submitAdditionalOrder(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(ADDITIONAL_ORDER_SHEET_NAME);

  // シートが無ければ自動作成
  if (!sheet) {
    sheet = ss.insertSheet(ADDITIONAL_ORDER_SHEET_NAME);
    const headers = [
      'ブレンダーID', '受信日時', '元レシピID', '同じレシピか', 'レシピ内容',
      '200ml本数', '720ml本数',
      '宛名', '電話', '郵便番号', '住所', '建物名', 'ギフトフラグ', '備考'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  // 追加注文にもブレンダーIDを発番
  const blenderId = getAndIncrementBlenderId();
  const now     = new Date();
  const dateStr = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');

  // レシピ内容を文字列化
  let recipeContent = data.sameRecipe
    ? '最初に登録したレシピと同じ'
    : (data.blends || []).filter(b => b && b.name).map(b => `${b.name} ${b.ml}ml`).join('、');

  const row = [
    blenderId,
    dateStr,
    data.originalId    || '',
    data.sameRecipe    ? 'はい' : 'いいえ',
    recipeContent,
    data.qty200        || 0,
    data.qty720        || 0,
    data.recipientName || '',
    data.phone         || '',
    data.zipcode       || '',
    data.address       || '',
    data.building      || '',
    data.isGift        ? 'はい' : 'いいえ',
    data.notes         || ''
  ];

  sheet.appendRow(row);
  return { success: true, blenderId: blenderId };
}

// ===== お酒を追加 =====
function addSake(name) {
  if (!name || !name.trim()) throw new Error('お酒の名前が必要です');
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SAKE_SHEET_NAME);
  if (!sheet) throw new Error('酒リストシートが見つかりません');
  sheet.appendRow([name.trim()]);
  return { success: true };
}

// ===== お酒を削除 =====
function deleteSake(name) {
  if (!name) throw new Error('お酒の名前が必要です');
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SAKE_SHEET_NAME);
  if (!sheet) throw new Error('酒リストシートが見つかりません');
  const lastRow = sheet.getLastRow();
  for (let i = lastRow; i >= 1; i--) {
    if (sheet.getRange(i, 1).getValue() === name) {
      sheet.deleteRow(i);
      return { success: true };
    }
  }
  throw new Error('対象が見つかりません: ' + name);
}

// ===== 確認済みステータス更新 =====
function updateStatus(id) {
  if (!id) throw new Error('ブレンダーIDが必要です');
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(RECIPE_SHEET_NAME);
  if (!sheet) throw new Error('レシピシートが見つかりません');
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  for (let i = 2; i <= lastRow; i++) {
    if (String(sheet.getRange(i, 1).getValue()) === String(id)) {
      sheet.getRange(i, lastCol).setValue('✓');
      return { success: true };
    }
  }
  throw new Error('対象が見つかりません: ' + id);
}

// ===== 初期設定（初回・スキーマ変更時に手動実行）=====
function initialize() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // --- 酒リストシート ---
  let sakeSheet = ss.getSheetByName(SAKE_SHEET_NAME) || ss.insertSheet(SAKE_SHEET_NAME);
  sakeSheet.clearContents();
  const sakeList = [['龍勢'],['英勲'],['神蔵'],['神聖'],['にいだしぜんしゅ'],['抱腹絶倒'],['TAMA'],['2013ヴィンテージ']];
  sakeSheet.getRange(1, 1, sakeList.length, 1).setValues(sakeList);

  // --- レシピシート ---
  // 1列目: ブレンダーID（シンプルな連番）、ユーザー入力IDは廃止
  let recipeSheet = ss.getSheetByName(RECIPE_SHEET_NAME) || ss.insertSheet(RECIPE_SHEET_NAME);
  const recipeHeaders = [
    'ブレンダーID', '受信日時', '制作日', 'レシピ名', '名前', 'ブレンダー名', 'ラベル色',
    '酒1名','酒1ml','酒2名','酒2ml','酒3名','酒3ml','酒4名','酒4ml',
    '酒5名','酒5ml','酒6名','酒6ml','酒7名','酒7ml','酒8名','酒8ml',
    'メール', '確認済み'
  ];
  recipeSheet.getRange(1, 1, 1, recipeHeaders.length).setValues([recipeHeaders]);

  // --- 設定シート ---
  let settingsSheet = ss.getSheetByName(SETTINGS_SHEET_NAME) || ss.insertSheet(SETTINGS_SHEET_NAME);
  settingsSheet.clearContents();
  settingsSheet.getRange(1, 1, 5, 2).setValues([
    ['label_options',      '白ラベル,黒ラベル'],
    ['target_ml',          '40'],
    ['max_rows',           '8'],
    ['guide_text',         'お好みのお酒を組み合わせてオリジナルブレンドを作りましょう'],
    ['blender_id_counter', '0']  // 次に発番される番号 = counter + 1
  ]);

  // --- 追加注文シート ---
  let addSheet = ss.getSheetByName(ADDITIONAL_ORDER_SHEET_NAME) || ss.insertSheet(ADDITIONAL_ORDER_SHEET_NAME);
  const addHeaders = [
    'ブレンダーID','受信日時','元レシピID','同じレシピか','レシピ内容',
    '200ml本数','720ml本数','宛名','電話','郵便番号','住所','建物名','ギフトフラグ','備考'
  ];
  addSheet.getRange(1, 1, 1, addHeaders.length).setValues([addHeaders]);

  Logger.log('✅ 初期設定完了');
}
