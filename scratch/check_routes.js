const router = require('../routes/apiRoutes');

function printRoutes(path, layer) {
  if (layer.route) {
    layer.route.stack.forEach(function(stack) {
      console.log(`${stack.method.toUpperCase()} ${path}${layer.route.path}`);
    });
  } else if (layer.name === 'router' && layer.handle.stack) {
    layer.handle.stack.forEach(function(stack) {
      printRoutes(path + (layer.regexp.source.replace('^\\/', '').replace('\\/?(?=\\/|$)', '')), stack);
    });
  }
}

router.stack.forEach(function(layer) {
  printRoutes('/api', layer);
});
