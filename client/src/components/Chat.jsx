import MessageContent from "./MessageContent";
import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useSelector } from "react-redux";
import { Button, List, Avatar, Input, Badge, Modal, Spin } from "antd";
import {
  MessageOutlined,
  UserOutlined,
  CloseOutlined,
  ArrowLeftOutlined,
  SendOutlined,
  PaperClipOutlined,
  SmileOutlined,
  AudioOutlined,
  PhoneOutlined,
  PhoneFilled,
  AudioMutedOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";

import axios from "axios";
import moment from "moment";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { useReactMediaRecorder } from "react-media-recorder";

const Chat = ({ courseId, instructorId, triggerButton }) => {
  const [visible, setVisible] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [socket, setSocket] = useState(null);
  const [chatsFetched, setChatsFetched] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const activeChatRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isOnline, setIsOnline] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const { status, startRecording, stopRecording, mediaBlobUrl, clearBlobUrl } =
    useReactMediaRecorder({ audio: true });
  const { user } = useSelector((state) => state.auth);

  const [isCalling, setIsCalling] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [isVideoPanelOpen, setIsVideoPanelOpen] = useState(false);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const handleEmojiClick = (emoji) => {
    setInputMessage((prev) => prev + emoji.native);
  };

  const getCourseTitle = (course) => {
    if (!course) return "";
    return course.courseTitle || course.title || "";
  };

  const API_BASE_URL =
    import.meta.env.VITE_API_URL || "http://localhost:8080/api/v1";
  const SOCKET_BASE_URL =
    import.meta.env.VITE_SOCKET_URL ||
    (import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace(/\/api\/v1$/, "")
      : "http://localhost:8080");

  // Check for mobile view
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    activeChatRef.current = activeChat ? activeChat._id : null;
  }, [activeChat]);

  const chatsRef = useRef([]);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  useEffect(() => {
    if (user) {
      const newSocket = io(SOCKET_BASE_URL, {
        withCredentials: true,
        query: { userId: user._id },
      });

      newSocket.on("connect", () => {
        console.log("Connected to socket server");
        newSocket.emit("register", user._id);
      });

      newSocket.on("newMessage", (message) => {
        const senderId =
          typeof message.sender === "string"
            ? message.sender
            : message.sender?._id;
        const receiverId =
          typeof message.receiver === "string"
            ? message.receiver
            : message.receiver?._id;

        // Ignore echoes of our own sent messages
        if (senderId === user._id) return;

        // Safety: only handle messages where we are the receiver
        if (receiverId !== user._id) return;

        const currentChatId = activeChatRef.current;
        const messageChatId =
          typeof message.chat === "string"
            ? message.chat
            : message.chat?._id;

        if (currentChatId && messageChatId && currentChatId === messageChatId) {
          setMessages((prev) => [...prev, message]);
          markMessagesAsRead([message._id]);
          setChats((prev) => {
            const existing = prev.find((c) => c._id === messageChatId);
            if (!existing) return prev;
            const updated = {
              ...existing,
              lastMessage: { ...message },
              updatedAt: message.timestamp || new Date().toISOString(),
            };
            const rest = prev.filter((c) => c._id !== messageChatId);
            return [updated, ...rest];
          });
        } else if (messageChatId) {
          updateUnreadCount(messageChatId);
          setChats((prev) => {
            const existing = prev.find((c) => c._id === messageChatId);
            if (!existing) return prev;
            const updated = {
              ...existing,
              lastMessage: { ...message },
              updatedAt: message.timestamp || new Date().toISOString(),
            };
            const rest = prev.filter((c) => c._id !== messageChatId);
            return [updated, ...rest];
          });

          // If somehow we don't have this chat locally (e.g., brand-new chat),
          // fetch the list so the sidebar reflects it.
          if (!chatsRef.current.find((c) => c._id === messageChatId)) {
            fetchChats();
          }
        }
      });

      newSocket.on("typing", () => setIsTyping(true));
      newSocket.on("stop typing", () => setIsTyping(false));

      newSocket.on("messagesRead", ({ messageIds }) => {
        setMessages((prev) =>
          prev.map((msg) =>
            messageIds.includes(msg._id) ? { ...msg, read: true } : msg
          )
        );
      });

      newSocket.on("messageDeleted", ({ messageId }) => {
        setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
      });

      newSocket.on("chatDeleted", ({ chatId }) => {
        setChats((prev) => prev.filter((chat) => chat._id !== chatId));
        if (activeChatRef.current === chatId) {
          setActiveChat(null);
          setMessages([]);
        }
      });

      newSocket.on("onlineUsers", (users) => {
        setOnlineUsers(users);
      });

      newSocket.on("online", (userId) => {
        setOnlineUsers((prev) => [...prev, userId]);
      });

      newSocket.on("offline", (userId) => {
        setOnlineUsers((prev) => prev.filter((id) => id !== userId));
      });

      newSocket.on("call:offer", ({ from, chatId, sdp }) => {
        setIncomingCall({ from, chatId, sdp });

        const chat = chatsRef.current.find((c) => c._id === chatId);
        if (chat && activeChatRef.current !== chatId) {
          setActiveChat(chat);
        }

        setVisible(true);
      });

      newSocket.on("call:answer", async ({ from, chatId, sdp }) => {
        if (!peerRef.current) return;
        try {
          await peerRef.current.setRemoteDescription(
            new RTCSessionDescription(sdp)
          );
          setIsCalling(false);
          setInCall(true);
        } catch (error) {
          console.error("Failed to handle call answer:", error);
          cleanupCall();
        }
      });

      newSocket.on(
        "call:ice-candidate",
        async ({ from, chatId, candidate }) => {
          if (!peerRef.current || !candidate) return;
          try {
            await peerRef.current.addIceCandidate(
              new RTCIceCandidate(candidate)
            );
          } catch (error) {
            console.error("Failed to add ICE candidate:", error);
          }
        }
      );

      newSocket.on("call:end", ({ from, chatId }) => {
        cleanupCall();
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [user]);

  useEffect(() => {
    if (socket && activeChat) {
      const receiverId =
        user.role === "student"
          ? activeChat.instructor._id
          : activeChat.student._id;

      if (inputMessage) {
        socket.emit("typing", { receiverId });
      }

      const timer = setTimeout(() => {
        socket.emit("stop typing", { receiverId });
      }, 3000);

      return () => {
        clearTimeout(timer);
        socket.emit("stop typing", { receiverId });
      };
    }
  }, [inputMessage, socket, activeChat, user.role]);

  useEffect(() => {
    if (activeChat) {
      const otherUser =
        user.role === "student" ? activeChat.instructor : activeChat.student;
      setIsOnline(onlineUsers.includes(otherUser._id));
    }
  }, [activeChat, onlineUsers, user.role]);

  useEffect(() => {
    if (visible && user) {
      fetchChats();
    }
  }, [visible, user]);

  useEffect(() => {
    if (activeChat) {
      fetchMessages(activeChat._id);
    }
  }, [activeChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target)
      ) {
        setShowEmojiPicker(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [emojiPickerRef]);

  const fetchChats = async () => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/chat/chats`, {
        withCredentials: true,
      });
      const chatList = data.data || [];
      setChats(chatList);
      setChatsFetched(true);

      const counts = {};
      chatList.forEach((chat) => {
        const last = chat.lastMessage;
        if (!last) {
          counts[chat._id] = 0;
          return;
        }
        const receiverId =
          typeof last.receiver === "string"
            ? last.receiver
            : last.receiver?._id;
        counts[chat._id] = !last.read && receiverId === user._id ? 1 : 0;
      });
      setUnreadCounts(counts);

      if (courseId && !activeChat) {
        const existing = chatList.find(
          (c) => c.course && c.course._id === courseId
        );
        if (existing) {
          setActiveChat(existing);
        }
      }

      return chatList;
    } catch (error) {
      console.error("Failed to fetch chats:", error);
      return null;
    }
  };

  const fetchMessages = async (chatId) => {
    try {
      const { data } = await axios.get(
        `${API_BASE_URL}/chat/messages/${chatId}`,
        {
          withCredentials: true,
        }
      );
      setMessages(data.data);

      const unreadMessages = data.data
        .filter((msg) => !msg.read && msg.receiver._id === user._id)
        .map((msg) => msg._id);

      if (unreadMessages.length > 0) {
        await axios.post(
          `${API_BASE_URL}/chat/mark-read`,
          { messageIds: unreadMessages },
          {
            withCredentials: true,
          }
        );
        setUnreadCounts((prev) => ({ ...prev, [chatId]: 0 }));
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    }
  };

  const markMessagesAsRead = async (messageIds) => {
    try {
      await axios.post(
        `${API_BASE_URL}/chat/mark-read`,
        { messageIds },
        {
          withCredentials: true,
        }
      );
    } catch (error) {
      console.error("Failed to mark messages as read:", error);
    }
  };

  const updateUnreadCount = (chatId, change = 1) => {
    setUnreadCounts((prev) => ({
      ...prev,
      [chatId]: Math.max(0, (prev[chatId] || 0) + change),
    }));
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !activeChat) return;

    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/chat/send`,
        {
          courseId: activeChat.course._id,
          receiverId:
            user.role === "student"
              ? activeChat.instructor._id
              : activeChat.student._id,
          content: inputMessage,
        },
        { withCredentials: true }
      );

      setMessages((prev) => [
        ...prev,
        {
          ...data.data,
          sender: user,
          receiver:
            user.role === "student"
              ? activeChat.instructor
              : activeChat.student,
        },
      ]);
      setChats((prev) => {
        if (!activeChat) return prev;
        const updated = {
          ...activeChat,
          lastMessage: {
            ...data.data,
            sender: user._id,
            receiver:
              user.role === "student"
                ? activeChat.instructor._id
                : activeChat.student._id,
          },
          updatedAt: data.data.timestamp || new Date().toISOString(),
        };
        const rest = prev.filter((c) => c._id !== activeChat._id);
        return [updated, ...rest];
      });
      setInputMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleFileSend = async (file) => {
    console.log("Sending file:", file);
    if (!file || !activeChat) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("courseId", activeChat.course._id);
    formData.append(
      "receiverId",
      user.role === "student"
        ? activeChat.instructor._id
        : activeChat.student._id
    );

    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/chat/send-file`,
        formData,
        {
          withCredentials: true,
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      console.log("File sent successfully:", data);
      setMessages((prev) => [...prev, data.data]);
      setChats((prev) => {
        if (!activeChat) return prev;
        const updated = {
          ...activeChat,
          lastMessage: {
            ...data.data,
            sender: user._id,
            receiver:
              user.role === "student"
                ? activeChat.instructor._id
                : activeChat.student._id,
          },
          updatedAt: data.data.timestamp || new Date().toISOString(),
        };
        const rest = prev.filter((c) => c._id !== activeChat._id);
        return [updated, ...rest];
      });
    } catch (error) {
      console.error("Failed to send file:", error);
    } finally {
      setUploading(false);
      setSelectedFile(null);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleSendAudio = async () => {
    if (mediaBlobUrl) {
      const blob = await fetch(mediaBlobUrl).then((r) => r.blob());
      const file = new File([blob], "audio.wav", {
        type: "audio/wav",
        lastModified: Date.now(),
      });
      handleFileSend(file);
      clearBlobUrl();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const startNewChat = async () => {
    try {
      await axios.post(
        `${API_BASE_URL}/chat/send`,
        {
          courseId,
          receiverId: instructorId,
          content: "Hello, I would like to start a chat regarding the course.",
        },
        { withCredentials: true }
      );

      setInputMessage("");
      const chatList = await fetchChats();
      if (chatList && courseId) {
        const existingChat = chatList.find(
          (c) => c.course && c.course._id === courseId
        );
        if (existingChat) {
          setActiveChat(existingChat);
        }
      }
    } catch (error) {
      console.error("Failed to start new chat:", error);
    }
  };

  const handleDeleteMessage = (message) => {
    Modal.confirm({
      title: "Delete message?",
      content: "This will delete the message for both participants.",
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await axios.delete(
            `${API_BASE_URL}/chat/message/${message._id}`,
            {
              withCredentials: true,
            }
          );
          setMessages((prev) => prev.filter((m) => m._id !== message._id));
          fetchChats();
        } catch (error) {
          console.error("Failed to delete message:", error);
        }
      },
    });
  };

  const handleDeleteChat = () => {
    if (!activeChat) return;

    Modal.confirm({
      title: "Delete chat?",
      content:
        "This will delete the entire conversation for both participants.",
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await axios.delete(
            `${API_BASE_URL}/chat/chat/${activeChat._id}`,
            {
              withCredentials: true,
            }
          );
          setChats((prev) =>
            prev.filter((chat) => chat._id !== activeChat._id)
          );
          setMessages([]);
          setActiveChat(null);
        } catch (error) {
          console.error("Failed to delete chat:", error);
        }
      },
    });
  };

  const totalUnreadCount = Object.values(unreadCounts).reduce(
    (a, b) => a + b,
    0
  );

  const hasCourseChat =
    !!courseId && chats.some((c) => c.course && c.course._id === courseId);

  const getOtherParticipant = (chat) => {
    if (!chat) return null;
    return user.role === "student" ? chat.instructor : chat.student;
  };

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.onicecandidate = (event) => {
      if (!event.candidate || !socket) return;
      const currentChatId = activeChatRef.current;
      if (!currentChatId) return;
      const chat = chatsRef.current.find((c) => c._id === currentChatId);
      if (!chat) return;
      const otherUser = getOtherParticipant(chat);
      if (!otherUser) return;

      socket.emit("call:ice-candidate", {
        receiverId: otherUser._id,
        from: user._id,
        chatId: chat._id,
        candidate: event.candidate,
      });
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      remoteStreamRef.current = remoteStream;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
      }
    };

    return pc;
  };

  const cleanupCall = () => {
    setIsCalling(false);
    setInCall(false);
    setIsMuted(false);
    setIncomingCall(null);
    setIsVideoPanelOpen(false);

    if (peerRef.current) {
      try {
        peerRef.current.onicecandidate = null;
        peerRef.current.ontrack = null;
        peerRef.current.close();
      } catch (error) {
        console.error("Error closing peer connection", error);
      }
      peerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  };

  const startCall = async () => {
    if (!socket || !activeChat) return;

    try {
      const otherUser = getOtherParticipant(activeChat);
      if (!otherUser) return;

      setIsCalling(true);
      setInCall(false);
      setIsMuted(false);

      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      localStreamRef.current = localStream;

      const pc = createPeerConnection();
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
      peerRef.current = pc;

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("call:offer", {
        receiverId: otherUser._id,
        from: user._id,
        chatId: activeChat._id,
        sdp: offer,
      });
    } catch (error) {
      console.error("Failed to start call:", error);
      cleanupCall();
    }
  };

  const acceptCall = async () => {
    if (!socket || !incomingCall) return;

    try {
      const { from, chatId, sdp } = incomingCall;
      const chat =
        chatsRef.current.find((c) => c._id === chatId) || activeChat;
      if (!chat) return;

      setIncomingCall(null);
      setIsCalling(false);
      setIsMuted(false);

      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      localStreamRef.current = localStream;

      const pc = createPeerConnection();
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
      peerRef.current = pc;

      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("call:answer", {
        receiverId: from,
        from: user._id,
        chatId,
        sdp: answer,
      });

      setInCall(true);
    } catch (error) {
      console.error("Failed to accept call:", error);
      cleanupCall();
    }
  };

  const declineCall = () => {
    if (!incomingCall) return;
    const { from, chatId } = incomingCall;
    setIncomingCall(null);
    if (socket) {
      socket.emit("call:end", {
        receiverId: from,
        from: user._id,
        chatId,
      });
    }
    cleanupCall();
  };

  const endCall = () => {
    const currentChatId =
      activeChatRef.current || (incomingCall && incomingCall.chatId);
    if (socket && currentChatId) {
      const chat = chatsRef.current.find((c) => c._id === currentChatId);
      if (chat) {
        const otherUser = getOtherParticipant(chat);
        if (otherUser) {
          socket.emit("call:end", {
            receiverId: otherUser._id,
            from: user._id,
            chatId: chat._id,
          });
        }
      }
    }
    cleanupCall();
  };

  const toggleMute = () => {
    const localStream = localStreamRef.current;
    if (!localStream) return;
    const nextMuted = !isMuted;
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
  };

  return (
    <>
      {triggerButton ? (
        React.cloneElement(triggerButton, {
          onClick: () => {
            setVisible(true);
            if (courseId) {
              const existingChat = chats.find((c) => c.course._id === courseId);
              if (existingChat) {
                setActiveChat(existingChat);
              }
            }
          },
        })
      ) : (
        <Badge count={totalUnreadCount} offset={[-5, 5]} size="small">
          <Button
            type="text"
            icon={<MessageOutlined />}
            onClick={() => setVisible(true)}
            style={{
              display: "flex",
              alignItems: "center",
              color: "#2c3e50",
              fontWeight: 500,
            }}
          >
            Messages
          </Button>
        </Badge>
      )}

      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center" }}>
            {isMobileView && activeChat && (
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                onClick={() => setActiveChat(null)}
                style={{ marginRight: 8 }}
              />
            )}
            {activeChat ? (
              <div style={{ display: "flex", alignItems: "center" }}>
                <Avatar
                  src={
                    user.role === "student"
                      ? activeChat.instructor?.photoUrl ||
                        "https://github.com/shadcn.png"
                      : activeChat.student?.photoUrl ||
                        "https://github.com/shadcn.png"
                  }
                  icon={<UserOutlined />}
                  style={{ backgroundColor: "#1890ff" }}
                />
                <div style={{ marginLeft: 12 }}>
                  <div style={{ fontWeight: 500, color: "#2c3e50" }}>
                    {user.role === "student"
                      ? activeChat.instructor?.name
                      : activeChat.student?.name}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", color: "#7f8c8d", fontSize: 12 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: isOnline ? "#2ecc71" : "#95a5a6",
                        marginRight: 4,
                      }}
                    />
                    {isOnline ? "Online" : "Offline"}
                  </div>
                  {activeChat.course && (
                    <div style={{ color: "#7f8c8d", fontSize: 12 }}>
                      {getCourseTitle(activeChat.course)}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <span style={{ fontWeight: 500, color: "#2c3e50" }}>
                Messages
              </span>
            )}
            {activeChat && (
              <div
                style={{
                  marginLeft: "auto",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Button
                  icon={<VideoCameraOutlined />}
                  onClick={() => setIsVideoPanelOpen((prev) => !prev)}
                  disabled={!isOnline}
                >
                  {isVideoPanelOpen ? "Hide Video" : "Video"}
                </Button>
                <Button
                  type="primary"
                  icon={<PhoneOutlined />}
                  onClick={startCall}
                  disabled={!isOnline || !socket || isCalling || inCall}
                  style={{ marginRight: 8 }}
                >
                  {isCalling ? "Calling..." : "Call"}
                </Button>
                <Button type="text" danger onClick={handleDeleteChat}>
                  Delete Chat
                </Button>
              </div>
            )}
          </div>
        }
        open={visible}
        onCancel={() => {
          setVisible(false);
          cleanupCall();
        }}
        footer={null}
        width={isMobileView ? "90%" : 800}
        styles={{ body: { padding: 0 } }}
        closable={false}
        closeIcon={<CloseOutlined style={{ color: "#7f8c8d" }} />}
        style={{ top: 20 }}
        className="chat-modal"
      >
        <div
          style={{
            display: "flex",
            height: isMobileView ? "70vh" : "60vh",
            flexDirection: isMobileView && activeChat ? "column" : "row",
          }}
        >
          {(!isMobileView || !activeChat) && (
            <div
              style={{
                width: isMobileView ? "100%" : 250,
                borderRight: "1px solid #ecf0f1",
                overflowY: "auto",
                backgroundColor: "#f8f9fa",
              }}
            >
              <div
                style={{
                  padding: 16,
                  borderBottom: "1px solid #ecf0f1",
                  backgroundColor: "#fff",
                }}
              >
                <Input.Search
                  placeholder="Search chats..."
                  style={{ width: "100%" }}
                />
              </div>
              <List
                dataSource={chats}
                renderItem={(chat) => {
                  const hasUnread = unreadCounts[chat._id] > 0;
                  return (
                    <List.Item
                      key={chat._id}
                      onClick={() => setActiveChat(chat)}
                      style={{
                        cursor: "pointer",
                        padding: 12,
                        backgroundColor:
                          activeChat?._id === chat._id
                            ? "#e8f4fd"
                            : hasUnread
                            ? "#f0f8ff"
                            : "#fff",
                        borderBottom: "1px solid #ecf0f1",
                        transition: "background-color 0.3s",
                      }}
                    >
                      <List.Item.Meta
                        avatar={
                          <Badge dot={hasUnread} color="#1890ff">
                            <Avatar
                              src={
                                user.role === "student"
                                  ? chat.instructor?.photoUrl ||
                                    "https://github.com/shadcn.png"
                                  : chat.student?.photoUrl ||
                                    "https://github.com/shadcn.png"
                              }
                              icon={<UserOutlined />}
                              style={{ backgroundColor: "#1890ff" }}
                            />
                          </Badge>
                        }
                        title={
                          <div
                            style={{
                              fontWeight: hasUnread ? 700 : 500,
                              color: "#2c3e50",
                            }}
                          >
                            {user.role === "student"
                              ? chat.instructor?.name
                              : chat.student?.name}
                          </div>
                        }
                        description={
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <span
                              style={{
                                color: "#7f8c8d",
                                fontSize: 12,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                maxWidth: "70%",
                                fontWeight: hasUnread ? "bold" : "normal",
                              }}
                            >
                              {chat.lastMessage?.content || "No messages yet"}
                            </span>
                            <span style={{ color: "#bdc3c7", fontSize: 12 }}>
                              {moment(chat.lastMessage?.timestamp).format(
                                "h:mm A"
                              )}
                            </span>
                          </div>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
              {user?.role === "student" && courseId && !hasCourseChat && (
                <div style={{ padding: 16 }}>
                  <Button
                    type="primary"
                    block
                    onClick={startNewChat}
                    style={{
                      backgroundColor: "#1890ff",
                      borderColor: "#1890ff",
                    }}
                  >
                    New Chat
                  </Button>
                </div>
              )}
            </div>
          )}

          {(!isMobileView || activeChat) && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                backgroundColor: "#fff",
              }}
            >
              {activeChat ? (
                <>
                  <audio
                    ref={remoteAudioRef}
                    autoPlay
                    style={{ display: "none" }}
                  />

                  {isVideoPanelOpen && (
                    <div
                      style={{
                        padding: "8px 16px 0",
                        borderBottom: "1px solid #ecf0f1",
                        backgroundColor: "#fdfdfd",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: 12,
                          marginBottom: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <div
                          style={{
                            flex: "1 1 160px",
                            minHeight: 120,
                            borderRadius: 8,
                            background:
                              "radial-gradient(circle at top left, #e3f2fd, #bbdefb)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#1f2933",
                            fontSize: 12,
                            fontWeight: 500,
                          }}
                        >
                          Your video
                        </div>
                        <div
                          style={{
                            flex: "1 1 160px",
                            minHeight: 120,
                            borderRadius: 8,
                            background:
                              "radial-gradient(circle at bottom right, #ffe0b2, #ffcc80)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#4b1f00",
                            fontSize: 12,
                            fontWeight: 500,
                          }}
                        >
                          Participant video
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: 8,
                          paddingBottom: 8,
                        }}
                      >
                        <Button
                          size="small"
                          icon={<AudioMutedOutlined />}
                          disabled
                        >
                          Mute
                        </Button>
                        <Button
                          size="small"
                          danger
                          icon={<CloseOutlined />}
                          onClick={() => setIsVideoPanelOpen(false)}
                        >
                          End
                        </Button>
                      </div>
                    </div>
                  )}

                  {incomingCall && !inCall && !isCalling && (
                    <div
                      style={{
                        padding: "8px 16px",
                        borderBottom: "1px solid #ecf0f1",
                        backgroundColor: "#fff7e6",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{ fontSize: 12, color: "#7f8c8d" }}
                      >
                        Incoming call...
                      </span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Button
                          type="primary"
                          size="small"
                          icon={<PhoneFilled />}
                          onClick={acceptCall}
                        >
                          Accept
                        </Button>
                        <Button
                          danger
                          size="small"
                          icon={<CloseOutlined />}
                          onClick={declineCall}
                        >
                          Decline
                        </Button>
                      </div>
                    </div>
                  )}

                  {(inCall || isCalling) && (
                    <div
                      style={{
                        padding: "8px 16px",
                        borderBottom: "1px solid #ecf0f1",
                        backgroundColor: "#e8f4fd",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{ fontSize: 12, color: "#2c3e50" }}
                      >
                        {isCalling ? "Calling..." : "In call"}
                      </span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Button
                          size="small"
                          icon={
                            isMuted ? <AudioMutedOutlined /> : <AudioOutlined />
                          }
                          onClick={toggleMute}
                          disabled={!inCall}
                        >
                          {isMuted ? "Unmute" : "Mute"}
                        </Button>
                        <Button
                          size="small"
                          danger
                          icon={<CloseOutlined />}
                          onClick={endCall}
                        >
                          End
                        </Button>
                      </div>
                    </div>
                  )}

                  <div
                    style={{
                      flex: 1,
                      overflowY: "auto",
                      padding: 16,
                      backgroundImage:
                        "linear-gradient(to bottom, #f8f9fa 0%, #fff 100%)",
                    }}
                  >
                    {messages.map((message) => {
                      const senderId =
                        typeof message.sender === "string"
                          ? message.sender
                          : message.sender?._id;
                      const isSender = senderId === user._id;

                      return (
                        <div
                          key={message._id}
                          style={{
                            display: "flex",
                            justifyContent: isSender ? "flex-end" : "flex-start",
                            marginBottom: 16,
                          }}
                        >
                          <div
                            style={{
                              maxWidth: "80%",
                              borderRadius: 12,
                              padding: "10px 14px",
                              backgroundColor: isSender ? "#1890ff" : "#ecf0f1",
                              color: isSender ? "white" : "#2c3e50",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                              position: "relative",
                            }}
                          >
                            <MessageContent message={message} user={user} />
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                alignItems: "center",
                                marginTop: 4,
                                fontSize: 11,
                                color: isSender
                                  ? "rgba(255,255,255,0.7)"
                                  : "rgba(0,0,0,0.45)",
                              }}
                            >
                              {moment(message.timestamp).format("h:mm A")}
                              {isSender && (
                                <>
                                  <span style={{ marginLeft: 4 }}>
                                    {message.read ? (
                                      <span style={{ color: "#70c1ff" }}>
                                        ✓✓
                                      </span>
                                    ) : (
                                      <span>✓</span>
                                    )}
                                  </span>
                                  <span
                                    style={{
                                      marginLeft: 8,
                                      fontSize: 11,
                                      cursor: "pointer",
                                      textDecoration: "underline",
                                    }}
                                    onClick={() => handleDeleteMessage(message)}
                                  >
                                    Delete
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                  {isTyping && (
                    <div style={{ padding: "0 16px", color: "#7f8c8d" }}>
                      is typing...
                    </div>
                  )}
                  <div
                    style={{
                      padding: 16,
                      borderTop: "1px solid #ecf0f1",
                      backgroundColor: "#fff",
                    }}
                  >
                    {selectedFile && (
                      <div>
                        {selectedFile.type.startsWith("image/") ? (
                          <img
                            src={URL.createObjectURL(selectedFile)}
                            alt="Preview"
                            style={{
                              maxWidth: "100px",
                              maxHeight: "100px",
                              marginBottom: "10px",
                            }}
                          />
                        ) : (
                          <p>Selected file: {selectedFile.name}</p>
                        )}
                        <Button onClick={() => handleFileSend(selectedFile)}>
                          Send File
                        </Button>
                        <Button onClick={() => setSelectedFile(null)}>
                          Cancel
                        </Button>
                      </div>
                    )}
                    {mediaBlobUrl && (
                      <div>
                        <audio src={mediaBlobUrl} controls />
                        <Button onClick={handleSendAudio}>Send Audio</Button>
                        <Button onClick={clearBlobUrl}>Cancel</Button>
                      </div>
                    )}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        style={{ display: "none" }}
                      />
                      <Button
                        icon={<PaperClipOutlined />}
                        onClick={() => fileInputRef.current.click()}
                        disabled={uploading}
                      />
                      {uploading && <Spin />}
                      <div ref={emojiPickerRef}>
                        <Button
                          icon={<SmileOutlined />}
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        />
                        {showEmojiPicker && (
                          <div
                            style={{
                              position: "absolute",
                              bottom: "80px",
                              right: "20px",
                              zIndex: 1000,
                            }}
                          >
                            <Picker
                              data={data}
                              onEmojiSelect={handleEmojiClick}
                            />
                          </div>
                        )}
                      </div>
                      <Button
                        icon={<AudioOutlined />}
                        onClick={
                          status === "recording" ? stopRecording : startRecording
                        }
                        danger={status === "recording"}
                      />
                      <Input.TextArea
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        placeholder="Type a message..."
                        autoSize={{ minRows: 1, maxRows: 4 }}
                        onPressEnter={(e) => {
                          if (!e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        style={{
                          borderRadius: 20,
                          padding: "8px 16px",
                          flex: 1,
                        }}
                      />
                      <Button
                        type="primary"
                        shape="circle"
                        icon={<SendOutlined />}
                        onClick={handleSendMessage}
                        disabled={!inputMessage.trim()}
                        style={{
                          backgroundColor: "#1890ff",
                          borderColor: "#1890ff",
                          width: 40,
                          height: 40,
                        }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    padding: 24,
                    textAlign: "center",
                    backgroundColor: "#f8f9fa",
                  }}
                >
                  <div
                    style={{
                      fontSize: 18,
                      color: "#7f8c8d",
                      marginBottom: 16,
                    }}
                  >
                    {user?.role === "student" && courseId
                      ? "Start a new conversation with your instructor"
                      : "Select a chat to view messages"}
                  </div>
                  {user?.role === "student" && courseId && !hasCourseChat && (
                    <Button
                      type="primary"
                      onClick={startNewChat}
                      style={{
                        backgroundColor: "#1890ff",
                        borderColor: "#1890ff",
                      }}
                    >
                      Start New Chat
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};

export default Chat;