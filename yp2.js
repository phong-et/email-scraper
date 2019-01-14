let rp = require('request-promise'),
  fs = require('fs'),
  cheerio = require('cheerio'),
  ypCfg = require('./msc.cfg'),
  log = console.log,
  headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:24.0) Gecko/20100101 Firefox/24.0',
  }
async function writeFile(fileName, content) {
  // await fs.writeFile(fileName, content, function(err) {
  //   if (err) return log(err)
  //   var statusText = 'write file > ' + fileName + ' success'
  //   log(statusText)
  // })
  return new Promise((resolve, reject) => {
    fs.writeFile(fileName, content, function(err) {
        if (err) reject(err)
        var statusText = 'write file > ' + fileName + ' success'
        log(statusText)
        resolve(statusText)
      })
  });
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
  log('Get categories next page :%s', url)
  await rp(options)
    .then($ => {
      categoriesSpellNext = getCategories($)
      // log('categoriesSpellNext.length:%s', categoriesSpellNext.length)
      // log(categoriesSpellNext)
    })
    .catch(function(err) {
      log(err)
    })
  return categoriesSpellNext
}

async function fetchCategoriesSpell(page, spell, province) {
  var categoriesSpell = []
  var url = page + '?spell=' + spell + '&province=' + province
  headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:24.0) Gecko/20100101 Firefox/24.0',
  }
  var options = {
    url: url,
    headers: headers,
    transform: function(body) {
      return cheerio.load(body)
    },
  }
  log('Get categories first page :%s', url)
  await rp(options)
    .then(async $ => {
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
    })
    .catch(function(err) {
      log(err)
    })
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

let page = ypCfg.ypCategoriesUrl,
  province = ypCfg.province,
  // Demo get one
  // spell = ypCfg.az[1],
  // fetchCategoriesSpell(page, spell, province).then(categories => {
  //   writeFile('yp/' + spell + '.txt', JSON.stringify(categories).toString())
  //   log(categories.length)
  //   log(categories)
  // })

  az = ypCfg.az
// await az.forEach(async spell => {
//     let categories = await fetchCategoriesSpell(page, spell, province)
//     writeFile('yp/' + spell + '.txt', JSON.stringify(categories).toString())
//     log(categories.length)
//     log(categories)
// })
var i = 0
async function start() {
  if (i == az.length) {
    log('Done ALL ')
  } else {
    let spell = az[i]
    log('az[%s]=%s', i, az[i])
    let categories = await fetchCategoriesSpell(page, spell, province)
    log(categories.length)
    log(categories)
    log('Done ' + az[i])
    i = i + 1
    start()
  }
}
start()
