export const openWindows = new Map();

export const folderContents = {
  photos: [
    { src: "photos/photo1.png", name: "Photo 1" },
    { src: "photos/photo2.png", name: "Photo 2" },
    { src: "photos/photo3.png", name: "Photo 3" },
  ],
  projects: [],
  trash: [],
};

export const currentIndex = { photos: 0, projects: 0, trash: 0 };

export const telegramState = {
  chats: [
    {
      id: 1,
      name: "Alice",
      avatar: "photos/photo1.jpg",
      messages: [{ type: "received", text: "Hi there!" }],
    },
    {
      id: 2,
      name: "Bob",
      avatar: "photos/photo2.jpg",
      messages: [{ type: "received", text: "Hello!" }],
    },
  ],
  activeChatId: 1,
};
