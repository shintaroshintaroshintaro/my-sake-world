/**
 * MY SAKE WORLD - Google Apps Script バックエンド
 *
 * ===== デプロイ手順 =====
 * 1. 対象スプレッドシート (ID: 1zvOH6pB2i3NLn0_15IzjrHmDHIJbI2j1dPQ1aA3UYMw) を開く
 * 2. 「拡張機能」→「Apps Script」を開く
 * 3. このコードを全て貼り付けて保存（Ctrl+S）
 * 4. 【初回・スキーマ変更時】関数「initialize」を実行してシートを初期化
 * 5. 「デプロイ」→「新しいデプロイ」→ 種類: ウェブアプリ
 * 6. 実行ユーザー: 自分 / アクセス: 全員 → デプロイ → URLをHTMLに貼り付け
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
      case 'updateOrder':            return createJsonResponse(updateOrder(data));
      case 'addSake':                return createJsonResponse(addSake(data.name));
      case 'deleteSake':             return createJsonResponse(deleteSake(data.name));
      case 'updateStatus':           return createJsonResponse(updateStatus(data.id));
      case 'updateFormSettings':     return createJsonResponse(updateFormSettings(data));
      case 'updateBlenderIdCounter': return createJsonResponse(updateBlenderIdCounter(data));
      case 'updateSakeEnName':       return createJsonResponse(updateSakeEnName(data));
      default: return createJsonResponse({ error: '不明なアクション: ' + data.action });
    }
  } catch (err) {
    return createJsonResponse({ error: err.toString() });
  }
}

// ===== 酒リスト取得 =====
// A列: 日本語名, B列: 英語名（任意）
function getSakeList() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SAKE_SHEET_NAME);
  if (!sheet) return { list: [] };
  const lastRow = sheet.getLastRow();
  if (lastRow === 0) return { list: [] };
  const cols   = Math.max(sheet.getLastColumn(), 2);
  const values = sheet.getRange(1, 1, lastRow, cols).getValues();
  const list   = values
    .filter(r => r[0] !== '')
    .map(r => ({
      name  : String(r[0]),
      nameEn: r[1] ? String(r[1]) : String(r[0])  // 英語名が空の場合は日本語名をそのまま使用
    }));
  return { list };
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
  return { orders }; // 管理者用：全カラム（スタッフ備考含む）
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

// ===== ブレンダーIDカウンター取得（管理画面用）=====
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
function updateBlenderIdCounter(data) {
  if (data.counter === undefined || data.counter === null) throw new Error('counterが必要です');
  const val = parseInt(data.counter);
  if (isNaN(val) || val < 0) throw new Error('0以上の数値を指定してください');
  return updateFormSettings({ key: 'blender_id_counter', value: String(val) });
}

// ===== レシピ送信 =====
// ブレンダーIDはお客様が入力した4桁数字をそのまま使用
function submitRecipe(data) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(RECIPE_SHEET_NAME);
  if (!sheet) throw new Error('レシピシートが見つかりません');

  const blenderId = data.blenderId || '';
  // username + domain で分割送信された場合はGAS側で結合
  const email = data.email || (data.emailUsername && data.emailDomain
    ? data.emailUsername + '@' + data.emailDomain : '');
  const now       = new Date();
  const dateStr   = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');

  Logger.log('submitRecipe 開始: blenderId=' + blenderId + ', name=' + data.name + ', email=' + email);

  // 行データ組み立て
  const row = [
    blenderId,
    dateStr,
    data.date        || '',
    data.recipeName  || '',
    data.name        || '',
    data.blenderName || '',
    data.labelColor  || '',
  ];

  // 最大8種のブレンド（酒名・mlを交互に格納）
  for (let i = 0; i < 8; i++) {
    const b = data.blends && data.blends[i];
    row.push(b ? (b.name || '') : '');
    row.push(b ? (b.ml   || '') : '');
  }

  row.push(email);
  row.push('');  // 確認済みフラグ
  row.push('');  // スタッフ備考

  sheet.appendRow(row);
  Logger.log('submitRecipe: スプレッドシートへの書き込み完了');

  // 確認メール送信（エラーでもレシピ保存は成功として返す）
  // メール送信（email変数を含むdataコピーを渡す）
  try {
    sendConfirmationEmail({ ...data, email: email }, blenderId);
  } catch (emailErr) {
    Logger.log('メール送信エラー: ' + emailErr.toString());
  }

  return { success: true, blenderId: blenderId };
}

// ===== 確認メール送信 =====
const CONFIRM_FROM_ADDRESS = 'mysakeworld@gmail.com'; // 送信元アドレス（このGoogleアカウントでGASプロジェクトを実行する前提）
const CONFIRM_FROM_NAME    = 'MY SAKE WORLD';
function sendConfirmationEmail(data, blenderId) {
  Logger.log('sendConfirmationEmail 開始: to=' + data.email + ', blenderId=' + blenderId);
  if (!data.email) {
    Logger.log('sendConfirmationEmail: メールアドレスなし、スキップ');
    return;
  }

  const now        = new Date();
  const expiryDate = new Date(now);
  expiryDate.setMonth(expiryDate.getMonth() + 6);
  const expiryStr   = Utilities.formatDate(expiryDate, 'Asia/Tokyo', 'yyyy年MM月dd日');
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

  const subject = '【MY SAKE WORLD】あなたのMy Sakeレシピが登録されました';
  try {
    GmailApp.sendEmail(data.email, subject, body, { from: CONFIRM_FROM_ADDRESS, name: CONFIRM_FROM_NAME });
    Logger.log('sendConfirmationEmail: 送信成功 from=' + CONFIRM_FROM_ADDRESS + ' to=' + data.email);
  } catch (e) {
    // エイリアスが使えない場合に備え、fromを指定せずデフォルトのアドレスで再試行
    Logger.log('sendConfirmationEmail: from指定での送信に失敗、デフォルトアドレスで再試行: ' + e.toString());
    try {
      GmailApp.sendEmail(data.email, subject, body);
      Logger.log('sendConfirmationEmail: デフォルトアドレスで送信成功 to=' + data.email);
    } catch (e2) {
      Logger.log('sendConfirmationEmail: GmailApp失敗、MailAppで再試行: ' + e2.toString());
      MailApp.sendEmail({ to: data.email, subject: subject, body: body });
      Logger.log('sendConfirmationEmail: MailApp送信完了（デフォルトアドレス）');
    }
  }
}

// ===== 追加注文送信 =====
function submitAdditionalOrder(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(ADDITIONAL_ORDER_SHEET_NAME);

  // シートが無ければ自動作成
  if (!sheet) {
    sheet = ss.insertSheet(ADDITIONAL_ORDER_SHEET_NAME);
    const headers = [
      'ブレンダーID', '受信日時', '発注者名', 'メール',
      '200ml本数', '720ml本数', 'ギフトフラグ',
      '宛名', '電話', '郵便番号', '住所', '建物名'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  const blenderId = data.blenderId || '';
  // username + domain で分割送信された場合はGAS側で結合
  const ordererEmail = data.ordererEmail || (data.ordererEmailUsername && data.ordererEmailDomain
    ? data.ordererEmailUsername + '@' + data.ordererEmailDomain : '');
  const now     = new Date();
  const dateStr = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');

  Logger.log('submitAdditionalOrder 開始: blenderId=' + blenderId + ', orderer=' + data.ordererName);

  const row = [
    blenderId,
    dateStr,
    data.ordererName || '',
    ordererEmail,
    data.qty200        || 0,
    data.qty720        || 0,
    data.isGift        ? 'はい' : 'いいえ',
    data.recipientName || '',
    data.phone         || '',
    data.zipcode       || '',
    data.address       || '',
    data.building      || ''
  ];

  sheet.appendRow(row);
  Logger.log('submitAdditionalOrder: スプレッドシートへの書き込み完了');

  // 注文完了メール送信（ordererEmail変数を含むdataコピーを渡す）
  try {
    sendAdditionalOrderEmail({ ...data, ordererEmail: ordererEmail }, blenderId);
  } catch (emailErr) {
    Logger.log('追加注文メール送信エラー: ' + emailErr.toString());
  }

  return { success: true };
}

// ===== 追加注文完了メール送信 =====
function sendAdditionalOrderEmail(data, blenderId) {
  Logger.log('sendAdditionalOrderEmail 開始: to=' + data.ordererEmail);
  if (!data.ordererEmail) {
    Logger.log('sendAdditionalOrderEmail: メールアドレスなし、スキップ');
    return;
  }

  const qty200    = parseInt(data.qty200) || 0;
  const qty720    = parseInt(data.qty720) || 0;
  const price200  = qty200 * 2000;
  const price720  = qty720 * 4900;
  const shipping  = 1000;
  const total     = price200 + price720 + shipping;

  const body =
`${data.ordererName || ''}さま

ご注文を承りました。ありがとうございます。

＿＿＿＿＿ ご注文内容 ＿＿＿＿＿
ブレンダーID：${blenderId}

【数量】
200ml × ${qty200}本　¥${price200.toLocaleString()}
720ml × ${qty720}本　¥${price720.toLocaleString()}
送料：¥${shipping.toLocaleString()}
─────────────
合計：¥${total.toLocaleString()}

【お届け先】
${data.isGift ? '（ギフト）' : ''}
宛名：${data.recipientName || ''}
〒${data.zipcode || ''}
${data.address || ''}${data.building ? ' ' + data.building : ''}
TEL：${data.phone || ''}
＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿

受注後、約一か月後にお届けいたします。
ご不明点やご相談は、店舗スタッフまでお気軽にお申し付けくださいませ。

MY SAKE WORLD`;

  const CC_ADDRESS = 'mysakeworldkyotokawaramachi@sakeworld.jp';
  const subject    = '【MY SAKE WORLD】ご注文を承りました';
  try {
    GmailApp.sendEmail(data.ordererEmail, subject, body, { cc: CC_ADDRESS, from: CONFIRM_FROM_ADDRESS, name: CONFIRM_FROM_NAME });
    Logger.log('sendAdditionalOrderEmail: 送信成功 from=' + CONFIRM_FROM_ADDRESS + ' to=' + data.ordererEmail + ' cc=' + CC_ADDRESS);
  } catch (e) {
    // エイリアスが使えない場合に備え、fromを指定せずデフォルトのアドレスで再試行
    Logger.log('sendAdditionalOrderEmail: from指定での送信に失敗、デフォルトアドレスで再試行: ' + e.toString());
    try {
      GmailApp.sendEmail(data.ordererEmail, subject, body, { cc: CC_ADDRESS });
      Logger.log('sendAdditionalOrderEmail: デフォルトアドレスで送信成功 to=' + data.ordererEmail + ' cc=' + CC_ADDRESS);
    } catch (e2) {
      Logger.log('sendAdditionalOrderEmail: GmailApp失敗、MailAppで再試行: ' + e2.toString());
      MailApp.sendEmail({ to: data.ordererEmail, cc: CC_ADDRESS, subject: subject, body: body });
      Logger.log('sendAdditionalOrderEmail: MailApp送信完了（デフォルトアドレス）');
    }
  }
}

// ===== 注文データ更新（管理者用）=====
// data.originalBlenderId: 検索キー（現在のブレンダーID）
// data.blenderId: 新しいブレンダーID
// その他: 更新するフィールド値
function updateOrder(data) {
  if (!data.originalBlenderId) throw new Error('originalBlenderIdが必要です');
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(RECIPE_SHEET_NAME);
  if (!sheet) throw new Error('レシピシートが見つかりません');

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  // ブレンダーIDで対象行を検索
  let targetRow = -1;
  for (let i = 2; i <= lastRow; i++) {
    if (String(sheet.getRange(i, 1).getValue()) === String(data.originalBlenderId)) {
      targetRow = i;
      break;
    }
  }
  if (targetRow < 0) throw new Error('対象が見つかりません: ' + data.originalBlenderId);

  // 更新フィールドのマッピング
  const fieldMap = {
    'ブレンダーID': data.blenderId,
    '名前'        : data.name,
    'ブレンダー名': data.blenderName,
    'レシピ名'    : data.recipeName,
    'ラベル色'    : data.labelColor,
    'メール'      : data.email,
    'スタッフ備考': data.staffNote,
  };

  // テキストフィールドを更新
  headers.forEach((h, i) => {
    if (fieldMap.hasOwnProperty(h) && fieldMap[h] !== undefined) {
      sheet.getRange(targetRow, i + 1).setValue(fieldMap[h]);
    }
  });

  // ブレンド配合を更新（data.blendsが渡された場合）
  if (data.blends) {
    for (let i = 0; i < 8; i++) {
      const b       = data.blends[i] || {};
      const nameIdx = headers.indexOf('酒' + (i + 1) + '名');
      const mlIdx   = headers.indexOf('酒' + (i + 1) + 'ml');
      if (nameIdx >= 0) sheet.getRange(targetRow, nameIdx + 1).setValue(b.name || '');
      if (mlIdx   >= 0) sheet.getRange(targetRow, mlIdx   + 1).setValue(b.ml   || '');
    }
  }

  Logger.log('updateOrder: ブレンダーID=' + data.originalBlenderId + ' の更新完了');
  return { success: true };
}

// ===== お酒を追加 =====
function addSake(name) {
  if (!name || !name.trim()) throw new Error('お酒の名前が必要です');
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SAKE_SHEET_NAME);
  if (!sheet) throw new Error('酒リストシートが見つかりません');
  // B列（英語名）は空で追加、後からupdateSakeEnNameで更新可能
  sheet.appendRow([name.trim(), '']);
  return { success: true };
}

// ===== お酒の英語名を更新 =====
function updateSakeEnName(data) {
  if (!data.name) throw new Error('お酒の名前が必要です');
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SAKE_SHEET_NAME);
  if (!sheet) throw new Error('酒リストシートが見つかりません');
  const lastRow = sheet.getLastRow();
  for (let i = 1; i <= lastRow; i++) {
    if (sheet.getRange(i, 1).getValue() === data.name) {
      sheet.getRange(i, 2).setValue(data.nameEn || '');
      Logger.log('updateSakeEnName: ' + data.name + ' → ' + data.nameEn);
      return { success: true };
    }
  }
  throw new Error('対象が見つかりません: ' + data.name);
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

  // ヘッダーから確認済み列を動的に検索
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const confirmCol = headers.indexOf('確認済み') + 1;
  if (confirmCol === 0) throw new Error('確認済み列が見つかりません');

  for (let i = 2; i <= lastRow; i++) {
    if (String(sheet.getRange(i, 1).getValue()) === String(id)) {
      sheet.getRange(i, confirmCol).setValue('✓');
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
  // A列: 日本語名, B列: 英語名
  const sakeList = [
    ['龍勢',           'Ryusei'],
    ['英勲',           'Eikun'],
    ['神蔵',           'Mikura'],
    ['神聖',           'Shinsei'],
    ['にいだしぜんしゅ', 'Niida Shizenshu'],
    ['抱腹絶倒',       'Hofuku Zettou'],
    ['TAMA',          'TAMA'],
    ['2013ヴィンテージ', '2013 Vintage']
  ];
  sakeSheet.getRange(1, 1, sakeList.length, 2).setValues(sakeList);

  // --- レシピシート ---
  // 1列目: ブレンダーID（お客様手入力の4桁数字）、末尾にスタッフ備考追加
  let recipeSheet = ss.getSheetByName(RECIPE_SHEET_NAME) || ss.insertSheet(RECIPE_SHEET_NAME);
  const recipeHeaders = [
    'ブレンダーID', '受信日時', '制作日', 'レシピ名', '名前', 'ブレンダー名', 'ラベル色',
    '酒1名','酒1ml','酒2名','酒2ml','酒3名','酒3ml','酒4名','酒4ml',
    '酒5名','酒5ml','酒6名','酒6ml','酒7名','酒7ml','酒8名','酒8ml',
    'メール', '確認済み', 'スタッフ備考'
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
    ['blender_id_counter', '0']
  ]);

  // --- 追加注文シート ---
  let addSheet = ss.getSheetByName(ADDITIONAL_ORDER_SHEET_NAME) || ss.insertSheet(ADDITIONAL_ORDER_SHEET_NAME);
  const addHeaders = [
    'ブレンダーID', '受信日時', '発注者名', 'メール',
    '200ml本数', '720ml本数', 'ギフトフラグ',
    '宛名', '電話', '郵便番号', '住所', '建物名'
  ];
  addSheet.getRange(1, 1, 1, addHeaders.length).setValues([addHeaders]);

  Logger.log('✅ 初期設定完了');
}
