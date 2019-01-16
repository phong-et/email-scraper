let rp = require('request-promise'),
  fs = require('fs'),
  cheerio = require('cheerio'),
  ypCfg = require('./msc.cfg'),
  log = console.log,
  headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:24.0) Gecko/20100101 Firefox/24.0',
  }
async function writeFile(fileName, content) {
  return new Promise((resolve, reject) => {
    fs.writeFile(fileName, content, function(err) {
      if (err) reject(err)
      var statusText = 'write file > ' + fileName + ' success'
      log(statusText)
      resolve(statusText)
    })
  })
}
async function appendFile(fileName, content) {
  return new Promise((resolve, reject) => {
    fs.writeFile(fileName, content, function(err) {
      if (err) reject(err)
      var statusText = 'append file > ' + fileName + ' success'
      log(statusText)
      resolve(statusText)
    })
  })
}

async function fetchCategoriesSpellNext(page, spell, province, form) {
  var categoriesSpellNext = []
  var url = page + '?spell=' + spell + '&province=' + province
  var options = {
    method: 'POST',
    url: url,
    form: form,
    headers: headers,
    transform: function(body) {
      return cheerio.load(body)
    },
  }
  // await log('Get categories next page :%s', url)
  const $ = await rp(options)
  categoriesSpellNext = getCategories($)
  // log('categoriesSpellNext.length:%s', categoriesSpellNext.length)
  // log(categoriesSpellNext)

  return categoriesSpellNext
}
async function fetchCategoriesSpell(page, spell, province) {
  var categoriesSpell = []
  var url = page + '?spell=' + spell + '&province=' + province
  var options = {
    url: url,
    headers: headers,
    transform: function(body) {
      return cheerio.load(body)
    },
  }
  //await log('Get categories first page :%s', url)
  const $ = await rp(options)
  var form = {
    __EVENTTARGET: 'dskhuchexuat$ctl28$lbtLast',
    __EVENTARGUMENT: '',
    __VIEWSTATE: $('#__VIEWSTATE').val(),
    __VIEWSTATEGENERATOR: $('#__VIEWSTATEGENERATOR').val(),
  }
  // log(form)
  // log(getCategories($))

  categoriesSpell = categoriesSpell.concat(getCategories($))
  // log('categoriesSpell.length:%s', categoriesSpell.length)
  // log(categoriesSpell)

  // have next page categories
  if ($('#dskhuchexuat_ctl28_lbtLast').length > 0) {
    var categoriesSpellNext = await fetchCategoriesSpellNext(page, spell, province, form)
    // log('categoriesSpellNext.length:%s', categoriesSpellNext.length)
    // log(categoriesSpellNext)
    categoriesSpell = categoriesSpell.concat(categoriesSpellNext)
  }

  await writeFile('yp/' + spell + '.txt', JSON.stringify(categoriesSpell).toString())
  return categoriesSpell
}

function getCategories($) {
  var categories = []
  var domCategories = $('#dskhuchexuat span')
  for (var i = 0; i < domCategories.length; i++) {
    var aTagHtml = domCategories
      .eq(i)
      .html()
      .trim()
    var aTag = cheerio.load(aTagHtml)('a')
    var name = aTag
      .text()
      .trim()
      .replace(/,/g, ' -')
    var href = aTag.attr('href')
    var id = 0
    try {
      if (href != '' && href != undefined) id = href.match(/\d+/)[0]
    } catch (err) {
      log(err)
    }
    if (name != '') {
      categories.push({name: name, id: id})
    }
  }
  return categories
}

// ========= FETCH TRADE ========== //
async function fetchTradeByCategory(page, category, province) {
  var url = page
  const $ = await rp({
    url: url,
    form: {
      ClassId: category.id,
      Province: province,
    },
    headers: headers,
    transform: function(body) {
      return cheerio.load(body)
    },
  })
  getMails($, category.name)
}
async function getMails($, fileName) {
  var domMail = $('a.tooltip-example-2')
  log('domMail.length:%s', domMail.length)
  if (domMail.length > 0) {
    var mails = []
    for (var i = 0; i < domMail.length; i++) {
      try {
        var href = domMail.eq(i).attr('href')
        if (href != '' && href != undefined)
          if (href.indexOf('mailto:') == 0)
            //log(href.substr(7));
            mails.push(href.substr(7))
      } catch (err) {
        //log(err)
      }
    }
    fileName += '.txt'
    await appendFile('yp/' + fileName, '\r\n' + mails.toString().replace(/,/g, '\r\n'))
  } else log('mail not found')
}

// ============ Modern forEach method  ============
let page = ypCfg.ypCategoriesUrl,
  province = ypCfg.province
ypCfg.az.forEach(async spell => {
  let categories = await fetchCategoriesSpell(page, spell, province)
  log(categories.length)
  log(categories)
  categories.forEach(async category => {
    await fetchTradeByCategory(ypCfg.ypTradeUrl, category, 2)
  })  
})

// ============ Modern Promise.all method  ============
// (async function() {
//   await Promise.all(
//     ypCfg.az.map(async az => {
//       let categories = await fetchCategoriesSpell(ypCfg.ypCategoriesUrl, az, ypCfg.province)
//       log(categories.length)
//       log(categories)
//     })
//   )
// })()

// ============ Classic Method ============
// let page = ypCfg.ypCategoriesUrl,
//   province = ypCfg.province,
// var i = 0,
//   az = ypCfg.az
// async function start() {
//   if (i == az.length) {
//     log('Done ALL ')
//   } else {
//     let spell = az[i]
//     log('az[%s]=%s', i, az[i])
//     let categories = await fetchCategoriesSpell(page, spell, province)
//     log(categories.length)
//     log(categories)
//     log('Done ' + az[i])
//     i = i + 1
//     start()
//   }
// }
// start()
