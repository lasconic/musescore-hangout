/*
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index', { title: 'Paste a MuseScore.com URL' })
};