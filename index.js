var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var userList = {};
var fyreList = [];
var typingUsers = {};
var clients = {};

app.get('/', function(req, res){
  res.send('<h1>FyrePlace Server</h1>');
});


http.listen(process.env.PORT || 3000, function(){
  console.log('Listening on *:3000');
});


io.on('connection', function(clientSocket){
  console.log('a user connected');
  io.to(clientSocket.id).emit("fyreList", fyreList);

  clientSocket.on('disconnect', function(){
    console.log('user disconnected');
  });


  clientSocket.on("exitUser", function(clientNickname) {
    var fyreName = clientSocket.fyre;
    for (var i=0; i<userList[fyreName].length; i++) {
      if (userList[fyreName][i]["id"] == clientSocket.id) {
        userList[fyreName].splice(i,1);
        break;
      }
    }
    
    for (var i=0; i<clients[fyreName].length; i++) {
      if (clients[fyreName][i].id == clientSocket.id) {
        clients[fyreName].splice(i,1);
        break;
      }
    }
                  
    clientSocket.fyre = null;
                  
    clientSocket.leave(fyreName);
    console.log("User " + clientNickname + " was disconnected from " + fyreName);
                  
    for (var i=0; i<fyreList.length; i++) {
      if (fyreList[i]["name"] == fyreName) {
        fyreList[i]["size"] = fyreList[i]["size"] - 1;
        if (fyreList[i]["size"] != userList[fyreName].length) {
          console.log("ERROR: Inconsistent Group Size");
        }
        break;
      }
    }
                  
    io.in(fyreName).emit("userList", userList[fyreName]);
    io.in(fyreName).emit("userExitUpdate", clientNickname);
  });


  clientSocket.on('chatMessage', function(clientNickname, message){
    var currentDateTime = new Date().toLocaleString();
    var fyreName = clientSocket.fyre;
    delete typingUsers[fyreName][clientNickname];
    io.in(fyreName).emit("userTypingUpdate", typingUsers[fyreName]);
    io.in(fyreName).emit('newChatMessage', clientNickname, message, currentDateTime);
  });


  clientSocket.on("connectUser", function(clientNickname, fyreName) {

      var userInfo = {};
      var foundUser = false;
      if (userList[fyreName] != null) {
        for (var i=0; i<userList[fyreName].length; i++) {
          if (userList[fyreName][i]["nickname"] == clientNickname) {
            console.log("ERROR: Username already taken");
            io.to(clientSocket.id).emit("usernameTakenError")
            foundUser = true;
            break;
          }
        }
      }
      if (!foundUser) {
        userInfo["id"] = clientSocket.id;
        userInfo["nickname"] = clientNickname;
        userInfo["isConnected"] = true;
        if (userList[fyreName] == null) {
          userList[fyreName] = [];
        }
        
        clientSocket.username = clientNickname;
        clientSocket.fyre = fyreName;
        clientSocket.join(fyreName);
                  
        userList[fyreName].push(userInfo);
                  
        if (clients[fyreName] == null) {
          clients[fyreName] = [];
        }
        clients[fyreName].push(clientSocket);
        
        for (var i=0; i<fyreList.length; i++) {
          if (fyreList[i]["name"] == fyreName) {
            fyreList[i]["size"] = fyreList[i]["size"] + 1;
            if (fyreList[i]["size"] != userList[fyreName].length) {
              console.log("ERROR: Inconsistent Group Size");
            }
            break;
          }
        }
                  
        var message = "User " + clientNickname + " was connected to " + fyreName;
        console.log(message);
                  
        io.in(fyreName).emit("userList", userList[fyreName]);
        io.in(fyreName).emit("userConnectUpdate", userInfo);
      }
  });

  clientSocket.on("idleUser", function(clientNickname) {
    var fyreName = clientSocket.fyre;
    for (var i=0; i<userList[fyreName].length; i++) {
      if (userList[fyreName][i]["nickname"] == clientNickname) {
        userList[fyreName][i]["isConnected"] = false;
        console.log("User " + clientNickname + " is now idle");
        break;
      }
    }
                  
    io.in(fyreName).emit("userList", userList[fyreName]);
                  
    if (typingUsers[fyreName] != null && typingUsers[fyreName][clientNickname] != null) {
      delete typingUsers[fyreName][clientNickname];
      io.in(fyreName).emit("userTypingUpdate", typingUsers[fyreName]);
    }
                  
    for (var i=0; i<clients[fyreName].length; i++) {
      if (clients[fyreName][i].id == clientSocket.id) {
        clients[fyreName].splice(i,1);
        break;
      }
    }
    clientSocket.fyre = null;
    clientSocket.leave(fyreName);
  });
      
  clientSocket.on("activeUser", function(clientNickname, fyreName) {
    //if (userList[fyreName] != null) {
      for (var i=0; i<userList[fyreName].length; i++) {
        if (userList[fyreName][i]["nickname"] == clientNickname) {
          userList[fyreName][i]["id"] = clientSocket.id;
          userList[fyreName][i]["isConnected"] = true;
          clientSocket.username = clientNickname;
          clientSocket.fyre = fyreName;
          clientSocket.join(fyreName);
          clients[fyreName].push(clientSocket);
          console.log("User " + clientNickname + " is now active");
          break;
        }
      }
    //}

    io.in(fyreName).emit("userList", userList[fyreName]);
  });

  clientSocket.on("startType", function(clientNickname) {
    console.log("User " + clientNickname + " is writing a message...");
    var fyreName = clientSocket.fyre;
    if (typingUsers[fyreName] == null) {
    typingUsers[fyreName] = {};
    }
    typingUsers[fyreName][clientNickname] = 1;
    io.in(fyreName).emit("userTypingUpdate", typingUsers[fyreName]);
  });


  clientSocket.on("stopType", function(clientNickname) {
    console.log("User " + clientNickname + " has stopped writing a message...");
    var fyreName = clientSocket.fyre;
    if (typingUsers[fyreName] != null) {
      delete typingUsers[fyreName][clientNickname];
    }
    io.in(fyreName).emit("userTypingUpdate", typingUsers[fyreName]);
  });
      

  clientSocket.on("createFyre", function(fyreName, fyreOption, datetime) {
    var fyreInfo = {};
    
    fyreInfo["name"] = fyreName;
    fyreInfo["owner"] = "NOT YET IMPLEMENTED";
    fyreInfo["photo"] = "NOT YET IMPLEMENTED";
    fyreInfo["option"] = fyreOption;
    fyreInfo["size"] = 0;
    fyreInfo["status"] = "Active";
    fyreInfo["time"] = datetime;
    fyreList.push(fyreInfo);
                  
    console.log("Fyre " + fyreName + " was created.");
                  
    io.emit("fyreList", fyreList);
  });

      
  clientSocket.on("deleteFyre", function(fyreName) {
      for (var i=0; i<clients[fyreName].length; i++) {
        clients[fyreName][i].leave(fyreName);
      }
    
      delete clients[fyreName];
      delete userList[fyreName];
                  
      for (var i=0; i<fyreList.length; i++) {
        if (fyreList[i]["name"] == fyreName) {
          fyreList.splice(i,1);
          console.log("Fyre " + fyreName + " was deleted.");
          break;
        }
      }
      io.emit("fyreDeleted", fyreName);
      io.emit("fyreList", fyreList);
  });
      
  clientSocket.on("editFyre", function(fyreName, newFyreName, fyreOption) {
                  
    userList[newFyreName] = userList[fyreName];
    delete userList[fyreName];
                  
    clients[newFyreName] = clients[fyreName];
    delete clients[fyreName];
                  
    typingUsers[newFyreName] = typingUsers[fyreName];
    delete typingUsers[fyreName];
                  
    for (var i=0; i<fyreList.length; i++) {
      if (fyreList[i]["name"] == fyreName) {
        fyreList[i]["name"] = newFyreName;
        fyreList[i]["option"] = fyreOption;
        console.log("Fyre " + fyreName + " was edited");
        break;
      }
    }
    io.emit("fyreEdited", fyreName, newFyreName);
    io.emit("fyreList", fyreList);
  });
      
});
