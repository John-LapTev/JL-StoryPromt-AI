import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Chat } from "@google/genai";
import type { Frame } from '../types';

interface ChatMessageProps {
    text: string;
    onGenerateFrame: (prompt: string) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ text, onGenerateFrame }) => {
    const suggestionRegex = /\[GENERATE_PROMPT:"([^"]+)"\]/g;
    const parts = text.split(suggestionRegex);

    return (
        <p className="text-sm whitespace-pre-wrap">
            {parts.map((part, index) => {
                // Every odd index is a captured prompt
                if (index % 2 === 1) {
                    return (
                        <button
                            key={index}
                            onClick={() => onGenerateFrame(part)}
                            className="inline-flex items-center gap-2 text-left bg-primary/20 text-cyan-300 border border-primary/50 rounded-lg px-3 py-1.5 my-1 hover:bg-primary/40 transition-colors"
                        >
                            <span className="material-symbols-outlined text-base">add_photo_alternate</span>
                            <span>{part}</span>
                        </button>
                    );
                }
                return part;
            })}
        </p>
    );
};


interface ChatbotProps {
    isOpen: boolean;
    onClose: () => void;
    frames: Frame[];
    onGenerateFrame: (prompt: string) => void;
}

interface Message {
    sender: 'user' | 'bot';
    text: string;
}

export const Chatbot: React.FC<ChatbotProps> = ({ isOpen, onClose, frames, onGenerateFrame }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [chat, setChat] = useState<Chat | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && !chat) {
            if (!process.env.API_KEY) {
                console.error("API_KEY not set for chatbot");
                setMessages([{ sender: 'bot', text: 'Ошибка: API ключ не настроен.' }]);
                return;
            }
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const chatSession = ai.chats.create({
                model: 'gemini-2.5-flash',
                config: {
                    systemInstruction: `Ты — полезный, креативный ассистент и со-режиссер для создателя видео-раскадровок. 
- В начале каждого сообщения от пользователя ты будешь получать текущее состояние проекта в формате "## КОНТЕКСТ ##". Используй этот контекст, чтобы давать релевантные и конкретные советы.
- Твои ответы должны быть краткими и по делу.
- Если ты предлагаешь идею для нового кадра, СФОРМАТИРУЙ ее как специальный интерактивный элемент, используя следующий синтаксис: [GENERATE_PROMPT:"твой промт для генерации изображения здесь"]. Это позволит пользователю создать кадр одним кликом. Не используй markdown для этого.
Пример: "Отличная идея! После этого можно показать... [GENERATE_PROMPT:"Кинематографичный кадр, детектив смотрит на город с крыши"]"`,
                },
            });
            setChat(chatSession);
             setMessages([{ sender: 'bot', text: 'Чем могу помочь с вашей раскадровкой?' }]);
        }
    }, [isOpen, chat]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !chat || isLoading) return;

        const userMessage: Message = { sender: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
             // Prepare context to send along with the user's prompt
            const contextHeader = "## КОНТЕКСТ ТЕКУЩЕГО ПРОЕКТА ##\n";
            const frameContext = frames.length > 0
                ? frames.map((f, i) => `Кадр ${i + 1} (Длительность: ${f.duration}s): ${f.prompt || '(Без промта)'}`).join('\n')
                : "Проект пуст.";
            const fullMessage = `${contextHeader}${frameContext}\n\n## ЗАПРОС ПОЛЬЗОВАТЕЛЯ ##\n${input}`;

            const responseStream = await chat.sendMessageStream({ message: fullMessage });
            
            let botResponse = '';
            // Add a placeholder message for the bot
            setMessages(prev => [...prev, { sender: 'bot', text: '' }]); 

            for await (const chunk of responseStream) {
                botResponse += chunk.text;
                // Update the last message (the bot's placeholder) in the stream
                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = { sender: 'bot', text: botResponse };
                    return newMessages;
                });
            }
        } catch (error) {
            console.error("Chat error:", error);
            // Replace the bot placeholder with an error message
            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = { sender: 'bot', text: 'Извините, произошла ошибка.' };
                return newMessages;
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={`fixed top-0 right-0 h-full bg-[#191C2D] border-l border-white/10 shadow-2xl z-40 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'} w-full max-w-md flex flex-col`}>
            <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
                <h3 className="text-lg font-bold text-white">
                    JL Ассистент
                </h3>
                <button onClick={onClose} className="text-white/70 hover:text-white">
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs md:max-w-sm rounded-xl px-4 py-2 ${msg.sender === 'user' ? 'bg-primary text-white rounded-br-none' : 'bg-white/10 text-white/90 rounded-bl-none'}`}>
                           {msg.sender === 'bot' ? (
                                <ChatMessage text={msg.text} onGenerateFrame={onGenerateFrame} />
                            ) : (
                                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                            )}
                        </div>
                    </div>
                ))}
                 {isLoading && messages[messages.length - 1]?.sender !== 'bot' && (
                     <div className="flex gap-3 justify-start">
                         <div className="max-w-xs md:max-w-sm rounded-xl px-4 py-2 bg-white/10 text-white/90 rounded-bl-none">
                            <div className="flex gap-1.5 items-center">
                                <div className="size-1.5 bg-white/50 rounded-full animate-pulse delay-0"></div>
                                <div className="size-1.5 bg-white/50 rounded-full animate-pulse delay-150"></div>
                                <div className="size-1.5 bg-white/50 rounded-full animate-pulse delay-300"></div>
                            </div>
                         </div>
                     </div>
                 )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-white/10 shrink-0">
                <form onSubmit={handleSend} className="flex items-center gap-3">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Спросите что-нибудь..."
                        className="w-full bg-white/5 p-2 rounded-lg text-sm text-white/90 placeholder:text-white/40 focus:ring-2 focus:ring-primary border-none"
                        disabled={isLoading}
                    />
                    <button type="submit" disabled={isLoading || !input.trim()} className="flex items-center justify-center size-9 rounded-lg bg-primary text-white disabled:bg-gray-500">
                        <span className="material-symbols-outlined">send</span>
                    </button>
                </form>
            </div>
        </div>
    );
};