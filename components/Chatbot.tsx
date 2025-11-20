
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
        <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {parts.map((part, index) => {
                if (index % 2 === 1) {
                    return (
                        <button
                            key={index}
                            onClick={() => onGenerateFrame(part)}
                            className="inline-flex items-center gap-2 text-left w-full bg-primary/10 text-primary-light border border-primary/30 rounded-lg px-3 py-2 my-2 hover:bg-primary/20 transition-all group"
                        >
                            <span className="material-symbols-outlined text-base shrink-0 group-hover:scale-110 transition-transform">add_photo_alternate</span>
                            <span className="italic">"{part}"</span>
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
            const contextHeader = "## КОНТЕКСТ ТЕКУЩЕГО ПРОЕКТА ##\n";
            const frameContext = frames.length > 0
                ? frames.map((f, i) => `Кадр ${i + 1} (Длительность: ${f.duration}s): ${f.prompt || '(Без промта)'}`).join('\n')
                : "Проект пуст.";
            const fullMessage = `${contextHeader}${frameContext}\n\n## ЗАПРОС ПОЛЬЗОВАТЕЛЯ ##\n${input}`;
            const responseStream = await chat.sendMessageStream({ message: fullMessage });
            let botResponse = '';
            setMessages(prev => [...prev, { sender: 'bot', text: '' }]); 

            for await (const chunk of responseStream) {
                botResponse += chunk.text;
                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = { sender: 'bot', text: botResponse };
                    return newMessages;
                });
            }
        } catch (error) {
            console.error("Chat error:", error);
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
        <div className={`fixed top-0 right-0 h-full glass-panel z-[60] transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'} w-full max-w-md flex flex-col border-l border-white/10 shadow-glass`}>
            <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0 bg-white/5 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="size-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.5)]"></div>
                    <h3 className="text-lg font-bold font-display text-white tracking-wide">AI Ассистент</h3>
                </div>
                <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar bg-transparent">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex gap-3 animate-fade-in ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                         {msg.sender === 'bot' && (
                            <div className="size-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 mt-1">
                                <span className="material-symbols-outlined text-primary text-sm">smart_toy</span>
                            </div>
                        )}
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm border ${msg.sender === 'user' ? 'bg-primary/20 border-primary/50 text-white rounded-br-none' : 'bg-white/10 border-white/10 text-white/90 rounded-bl-none'}`}>
                           {msg.sender === 'bot' ? <ChatMessage text={msg.text} onGenerateFrame={onGenerateFrame} /> : <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>}
                        </div>
                    </div>
                ))}
                 {isLoading && messages[messages.length - 1]?.sender !== 'bot' && (
                     <div className="flex gap-3 justify-start">
                          <div className="size-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 mt-1">
                                <span className="material-symbols-outlined text-primary text-sm">smart_toy</span>
                            </div>
                         <div className="max-w-xs rounded-2xl px-4 py-4 bg-white/5 border border-white/10 text-white/90 rounded-bl-none">
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

            <div className="p-4 border-t border-white/10 shrink-0 bg-white/5 backdrop-blur-md">
                <form onSubmit={handleSend} className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Задайте вопрос или попросите идею..."
                        className="w-full glass-input rounded-xl pl-4 pr-12 py-3.5 text-sm placeholder:text-white/30"
                        disabled={isLoading}
                    />
                    <button type="submit" disabled={isLoading || !input.trim()} className="absolute right-1.5 top-1.5 size-9 rounded-lg bg-primary/80 text-white flex items-center justify-center hover:bg-primary hover:shadow-neon transition-all disabled:opacity-50 disabled:shadow-none disabled:bg-transparent">
                        <span className="material-symbols-outlined text-sm">send</span>
                    </button>
                </form>
            </div>
        </div>
    );
};
