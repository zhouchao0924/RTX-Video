const ImageMagick = require('./ImageMagick');

module.exports = (app) => {
  app.use('/api', ImageMagick);
};
