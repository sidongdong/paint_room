import http from "http"; 
import { Server, Socket } from "socket.io";
import express from "express";

const app = express();

app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/",(req,res) => res.render("home"));
app.get("/*",(req, res) => res.redirect("/")); //home url만 사용하도록 고정 시킴

const httpServer = http.createServer(app);
const wsServer = new Server(httpServer);

function publicRooms(){
    const {
        sockets: {
            adapter: { sids, rooms },
        },
    } =wsServer;
    const publicRooms = [];
    rooms.forEach((_, key) => {
        if (sids.get(key) === undefined) {
            publicRooms.push(key);
        }
    });
    return publicRooms;
} //사용자 말고 만들어진 방 저장

function countRoom(roomName){
    return wsServer.sockets.adapter.rooms.get(roomName)?.size;
}

wsServer.on("connection", (socket) => {
    socket["nickname"] = "익명이";
    socket.onAny((event) => {
        console.log(`Socket Event :${event}`);
    });
    socket.on("enterRoom", (enterRoom, done) => {
        socket["nickname"] = enterRoom.payload.nickName;
        socket.join(enterRoom.payload.roomName);
        done(); //방에 참가하면 done() 함수 호출-> done 함수는 프론트 엔드의 showRoom()실행
        socket.to(enterRoom.payload.roomName).emit("welcome", socket.nickname); //welcome 이벤트를 자신 제외 roomName에 있는 모든 사람에게 emit
        wsServer.to(enterRoom.payload.roomName).emit("peoplenum", countRoom(enterRoom.payload.roomName)); //자기자신 포함 전체에게 emit
        wsServer.sockets.emit("room_change", publicRooms());
    });
    socket.on("disconnecting", () => {
        socket.rooms.forEach((room) => 
            socket.to(room).emit("bye", socket.nickname, countRoom(room)-1) //자기자신이 아직 나가기 전이라 포함되어 세지므로 하나 뺀다
        );
    }); //참가자가 방을 나갈때
    socket.on("disconnect", () => {
        wsServer.sockets.emit("room_change", publicRooms());
    }); //public room이 없어질때
    socket.on("new_message", (msg, room, done) => {
        socket.to(room).emit("new_message",`${socket.nickname} : ${msg}`);
        done();
    });
    socket.on("nickname", (nickname) => ( socket["nickname"] = nickname ));
   
    socket.on("draw",(room,draw)=>{
        socket.to(room).emit("draw", draw.payload.painting, draw.payload.x, draw.payload.y)
    });
    
    socket.on("drawPen",(room,draw)=>{
        socket.to(room).emit("drawPen", draw.payload.drawing, draw.payload.x, draw.payload.y)
    });
    socket.on("drawPenStart",(room,draw)=>{
        socket.to(room).emit("drawPenStart", draw.payload.drawing, draw.payload.x, draw.payload.y)
    });
    socket.on("drawPenEnd",(room,draw)=>{
        socket.to(room).emit("drawPenEnd", draw.payload.drawing, draw.payload.x, draw.payload.y)
    });
    
    socket.on("color",(room,color)=>{
        socket.to(room).emit("color", color)
    });
    socket.on("penSize",(room,size)=>{
        socket.to(room).emit("penSize", size)
    });
    socket.on("filling",(room,filling)=>{
        socket.to(room).emit("filling", filling)
    });
});

const handleListen = () => console.log('Listening on http://localhost:3000'); //같은 포트에서 https랑 wss 둘 다 됨
httpServer.listen(3000, handleListen);

