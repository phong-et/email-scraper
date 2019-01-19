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
    fs.appendFile(fileName, content, function(err) {
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
  const response = await rp({
    url: url,
    method: 'POST',
    form: {
      ClassId: category.id,
      Province: province,
    },
    headers: headers,
    resolveWithFullResponse: true,
    transform: (body, res) => {
      return {$: cheerio.load(body), cookies: res.headers['set-cookie']}
    },
  })
  tradeMails = tradeMails.concat(getMails(response.$))
  fetchTradeByCategoryNext(response, category, url)
}
var isUseCookie = false,
  jar,
  count = 0,
  tradeMails = []
async function fetchTradeByCategoryNext(response, category, url) {
  let $ = response.$
  var __EVENTTARGET = hasNextPage($)
  if (__EVENTTARGET != false) {
    var form = {
      __EVENTTARGET: __EVENTTARGET,
      __EVENTARGUMENT: '',
      __VIEWSTATE: $('#__VIEWSTATE').val(),
      __VIEWSTATEGENERATOR: $('#__VIEWSTATEGENERATOR').val(),
      Keywords: splitCategoryName(category.name),
      Province: 'TP. HỒ CHÍ MINH',
      giatribody: $('#giatribody').val(),
      ScrollTop: '',
      __dnnVariable: {__scdoff: 1},
    }
    //log(form);
    if (isUseCookie == false) {
      jar = rp.jar()
      response.cookies.forEach(e => {
        e.split(';').forEach(cookie => {
          jar.setCookie(rp.cookie(cookie.trim()), url)
        })
      })
      //log(jar);
      isUseCookie = true
    }
    const r = await rp({
      url: url,
      method: 'POST',
      jar: jar,
      form: form,
      headers: headers,
      resolveWithFullResponse: true,
      transform: (body, res) => {
        return {$: cheerio.load(body), cookies: res.headers['set-cookie']}
      },
    })
    //log('isUseCookie:%s', isUseCookie)
    tradeMails = tradeMails.concat(getMails(r.$))
    var __EVENTTARGET = hasNextPage(r.$)
    //log('__EVENTTARGET:%s', __EVENTTARGET)
    if (__EVENTTARGET != false) {
      setTimeout(() => {
        fetchTradeByCategoryNext(r, category, url)
      },100)
    } else {
      log('tradeMails.length=%s',tradeMails.length)
      tradeMails = [...new Set(tradeMails)]
      log('tradeMails.length=%s(after filter)',tradeMails.length)
      await writeFile('yp/' + category.name + '.txt',tradeMails.toString().replace(/,/g, '\r\n'))
    }
  } else {
    log('tradeMails.length=%s',tradeMails.length)
    tradeMails = [...new Set(tradeMails)]
    log('tradeMails.length=%s(after filter)',tradeMails.length)
    await writeFile('yp/' + category.name + '.txt', tradeMails.toString().replace(/,/g, '\r\n'))
  }
}

function splitCategoryName(name) {
  return name.substr(0, name.indexOf(' ('))
}
//check "Trang Sau" is exist
function hasNextPage($) {
  try {
    var aTags = cheerio.load(
      $('#giatribody')
        .next()
        .html()
    )('a')
    for (var i = 0; i < aTags.length; i++) {
      if (
        aTags
          .eq(i)
          .text()
          .trim() == 'Trang sau'
      ) {
        var href = aTags.eq(i).attr('href')
        return href.substr(25, href.length - 30) // __EVENTTARGET || http://prntscr.com/fzlbsw
      }
      //log(aTags.eq(i).attr('href'))
    }
    return false
  } catch (err) {
    log(err)
    return false
  }
}
function getMails($) {
  var domMail = $('a.tooltip-example-2')
  //log('domMail.length:%s', domMail.length)
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
  } else log('mail not found')
  log('Mail of page %s : %s', count, mails.length)
  // clean email invalid
  mails = mails.filter(mail => mail !== null && mail != '' && mail !== undefined)
  // delete duplicate email
  // mails = [...new Set(mails)]
  log('Mail of page %s : %s(after clean)', count++, mails.length)
  return mails
}

// ============ Modern forEach method  ============
let page = ypCfg.ypCategoriesUrl,
  province = ypCfg.province
// ypCfg.az.forEach(async spell => {
//   let categories = await fetchCategoriesSpell(page, spell, province)
//   log(categories.length)
//   log(categories)
//   categories.forEach(async category => {
//     await fetchTradeByCategory(ypCfg.ypTradeUrl, category, 2)
//   })
//   //fetchTradeByCategory(ypCfg.ypTradeUrl, categories[0], 2)
// })
fetchCategoriesSpell(page, 'C', province)
//fetchTradeByCategory(ypCfg.ypTradeUrl, {name: 'CƠ KHÍ - GIA CÔNG & SẢN XUẤT', id: '601460'}, 2)

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
