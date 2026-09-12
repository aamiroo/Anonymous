# Eitaa Anonymous Messaging

A lightweight anonymous messaging Mini App built for **Eitaa**, with a Python backend powered by **FastAPI**.

The application allows users to open the Mini App, send anonymous messages, and later return to view their conversations and receive replies.

## ✨ Features

* Anonymous messaging through an Eitaa Mini App
* Eitaa account-based user identification
* Persistent conversation history
* Independent conversations for each new message
* Real-time communication using WebSocket
* FastAPI-based backend
* SQLite/PostgreSQL compatible database architecture
* Async Python backend
* Secure server-side validation of Eitaa `initData`
* Lightweight architecture suitable for deployment on a personal server or Android device

## 🏗️ Architecture

```text
Eitaa Mini App
      │
      ├── REST API
      │
      └── WebSocket
             │
             ▼
          FastAPI
             │
      ┌──────┴──────┐
      │             │
  SQLAlchemy    WebSocket
      │             │
      ▼             │
   Database         │
      │             │
      └──────┬──────┘
             ▼
        Application
```

## 🔐 Eitaa Authentication

The Mini App uses Eitaa's official WebApp SDK and sends the raw `initData` to the backend.

The backend validates the received `initData` before trusting the included user information.

```text
Eitaa Mini App
      │
      │ initData
      ▼
    FastAPI
      │
      │ Validate
      ▼
   User Identity
```

`initData` is validated server-side and is not trusted directly from the client.

## 💬 Messaging Model

Each new message starts a new conversation.

For example:

```text
User
 ├── Conversation #1
 │    ├── User message
 │    └── Reply
 │
 ├── Conversation #2
 │    ├── User message
 │    └── Reply
 │
 └── Conversation #3
      ├── User message
      └── Reply
```

Users can return to the Mini App and access their previous conversations.

## ⚡ Real-Time Communication

WebSocket is used for real-time message delivery.

```text
User
 │
 │ WebSocket
 ▼
FastAPI
 │
 │ WebSocket
 ▼
Application
```

This allows new replies to appear without requiring the user to refresh the Mini App.

REST API is used for operations such as authentication, conversation history, and message management, while WebSocket handles real-time events.

## 🧩 Backend Structure

```text
app/
├── main.py
├── config.py
│
├── database.py
├── models.py
│
├── auth.py
├── conversations.py
├── messages.py
├── admin.py
└── websocket.py
```

The project can later be refactored into a more modular structure as the application grows.

## 🗄️ Data Model

The core database consists of three main entities:

```text
AnonymousUser
      │
      └── Conversation
              │
              └── Message
```

### AnonymousUser

Stores the internal user record associated with an Eitaa account.

### Conversation

Represents an independent messaging session.

### Message

Stores individual messages belonging to a conversation.

## 🛠️ Tech Stack

* **Python**
* **FastAPI**
* **SQLAlchemy**
* **SQLite / PostgreSQL**
* **WebSocket**
* **Pydantic**
* **uv**
* **Eitaa Mini App SDK**

## 🚀 Development

Initialize the project with `uv`:

```bash
uv init
```

Install the main dependencies:

```bash
uv add fastapi uvicorn sqlalchemy pydantic-settings
```

For development:

```bash
uv add --dev pytest ruff
```

Run the development server:

```bash
uv run uvicorn app.main:app --reload
```

The API will be available locally through the FastAPI development server.

## 📱 Deployment

The backend is designed to remain platform-independent.

Development can be performed on Linux, while the same Python backend can later be deployed on an Android device capable of running Python services.

The application is intentionally kept lightweight to make deployment on resource-constrained environments practical.

## 🔒 Security

The project follows several basic security principles:

* Server-side validation of Eitaa `initData`
* Environment variables for secrets
* Database access through SQLAlchemy
* Input validation with Pydantic
* Protected application endpoints
* HTTPS for production deployment
* No hard-coded credentials

## 📌 Project Status

Currently under development.

The initial goal is to provide a functional anonymous messaging Mini App with:

* Eitaa authentication
* Persistent conversations
* Message history
* Real-time replies
* Lightweight Python backend
* Mobile-friendly deployment architecture

## 📄 License

This project is licensed under the
[GNU General Public License v3.0](./LICENSE).
