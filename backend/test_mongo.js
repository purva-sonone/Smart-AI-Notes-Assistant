const mongoose = require('mongoose');

const uri1 = "mongodb://purvasonone01:purva%40123@ac-zxzsbxc-shard-00-00.8bjhhdr.mongodb.net:27017,ac-zxzsbxc-shard-00-01.8bjhhdr.mongodb.net:27017,ac-zxzsbxc-shard-00-02.8bjhhdr.mongodb.net:27017/smart-notes?ssl=true&authSource=admin&retryWrites=true&w=majority";

mongoose.connect(uri1)
  .then(() => {
    console.log("Connected locally without srv!");
    process.exit(0);
  })
  .catch(err => {
    console.error("Local URI Error:", err);
    process.exit(1);
  });
