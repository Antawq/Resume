import photo1 from "../photos/photo1.webp";
import photo2 from "../photos/photo2.webp";
import photo3 from "../photos/photo3.webp";

export const openWindows = new Map();

export const folderContents = {
  photos: [
    { src: photo1, name: "Photo 1" },
    { src: photo2, name: "Photo 2" },
    { src: photo3, name: "Photo 3" },
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
      avatar: photo1,
      messages: [{ type: "received", text: "Hi there!" }],
    },
    {
      id: 2,
      name: "Bob",
      avatar: photo2,
      messages: [{ type: "received", text: "Hello!" }],
    },
  ],
  activeChatId: 1,
};
