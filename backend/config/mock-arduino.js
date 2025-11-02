const express = require("express");
const app = express();
const PORT = 4000;

app.get("/status", (req, res) => {
  const fakeData = {
    lat: 10.123456,
    lng: 123.456789,
    distance: Math.random() * 20,
    moved: Math.random() > 0.5,
  };
  res.json(fakeData);
});

app.listen(PORT, () => {
  console.log(`✅ Mock Arduino running at http://localhost:${PORT}`);
});
