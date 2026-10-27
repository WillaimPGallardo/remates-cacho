require('dotenv').config({ quiet: true });
const app = require('./app');
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API de Remates Cacho escuchando en http://localhost:${port}`));
