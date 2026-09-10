import Foundation

class RealtimeClient {
    private let ephemeralToken: String
    private let fallbackNumber: String?
    private let onAudioDelta: (Data) -> Void
    private let onTranscript: (String, String, String) -> Void
    private let onAIToolCall: (String, String, String, String) -> Void
    private let onError: (String) -> Void
    
    private var webSocket: URLSessionWebSocketTask?
    private var callId: String = ""
    
    init(ephemeralToken: String,
         fallbackNumber: String?,
         onAudioDelta: @escaping (Data) -> Void,
         onTranscript: @escaping (String, String, String) -> Void,
         onAIToolCall: @escaping (String, String, String, String) -> Void,
         onError: @escaping (String) -> Void) {
        self.ephemeralToken = ephemeralToken
        self.fallbackNumber = fallbackNumber
        self.onAudioDelta = onAudioDelta
        self.onTranscript = onTranscript
        self.onAIToolCall = onAIToolCall
        self.onError = onError
    }
    
    func connect(callId: String) {
        self.callId = callId
        guard let url = URL(string: "wss://api.openai.com/v1/realtime?model=gpt-realtime-2.1") else { return }
        var request = URLRequest(url: url)
        request.addValue("Bearer \(ephemeralToken)", forHTTPHeaderField: "Authorization")
        request.addValue("realtime=v1", forHTTPHeaderField: "OpenAI-Beta")
        
        let session = URLSession(configuration: .default)
        webSocket = session.webSocketTask(with: request)
        webSocket?.resume()
        
        sendSessionUpdate()
        receiveMessage()
    }
    
    private func sendSessionUpdate() {
        let num = fallbackNumber ?? "the store directly"
        let sessionUpdate: [String: Any] = [
            "type": "session.update",
            "session": [
                "voice": "alloy",
                "input_audio_format": "g711_ulaw",
                "output_audio_format": "g711_ulaw",
                "instructions": "You are a phone order-taking assistant for Pappa's restaurant. Your ONLY job is to take orders. If the customer has a complaint, wants to talk to sales, or has any non-order request, politely tell them to call \(num) and then use the endCall tool. When an order is completed and submitted via submitOrder, say goodbye and use the endCall tool.",
                "tools": [
                    [
                        "type": "function",
                        "name": "searchMenu",
                        "description": "Search the restaurant menu for items",
                        "parameters": [
                            "type": "object",
                            "properties": [
                                "query": ["type": "string"]
                            ]
                        ]
                    ],
                    [
                        "type": "function",
                        "name": "submitOrder",
                        "description": "Submit the finalized order to the POS",
                        "parameters": [
                            "type": "object",
                            "properties": [
                                "customerName": ["type": "string"],
                                "items": [
                                    "type": "string",
                                    "description": "Stringified JSON array of items"
                                ]
                            ]
                        ]
                    ],
                    [
                        "type": "function",
                        "name": "endCall",
                        "description": "End the phone call after an order is complete or if the customer is not making an order"
                    ]
                ]
            ]
        ]
        
        sendMessage(json: sessionUpdate)
    }
    
    private func receiveMessage() {
        webSocket?.receive { [weak self] result in
            guard let self = self else { return }
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self.handleJsonMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        self.handleJsonMessage(text)
                    }
                @unknown default:
                    break
                }
                self.receiveMessage()
            case .failure(let error):
                self.onError("WebSocket error: \(error.localizedDescription)")
                print("WebSocket error: \(error)")
            }
        }
    }
    
    private func handleJsonMessage(_ text: String) {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any],
              let type = json["type"] as? String else { return }
        
        switch type {
        case "response.audio.delta":
            if let base64Delta = json["delta"] as? String,
               let audioData = Data(base64Encoded: base64Delta) {
                onAudioDelta(audioData)
            }
        case "response.audio_transcript.done":
            if let transcript = json["transcript"] as? String, !transcript.isEmpty {
                onTranscript(callId, "ai", transcript)
            }
        case "conversation.item.input_audio_transcription.completed":
            if let transcript = json["transcript"] as? String, !transcript.isEmpty {
                onTranscript(callId, "customer", transcript)
            }
        case "response.function_call_arguments.done":
            if let callId = json["call_id"] as? String,
               let name = json["name"] as? String,
               let arguments = json["arguments"] as? String {
                onAIToolCall(self.callId, callId, name, arguments)
            }
        case "input_audio_buffer.speech_started":
            let interrupt = ["type": "response.cancel"]
            sendMessage(json: interrupt)
        case "error":
            if let errorObj = json["error"] as? [String: Any], let msg = errorObj["message"] as? String {
                onError("OpenAI Error: \(msg)")
            }
        default:
            break
        }
    }
    
    func sendAudio(g711Bytes: Data) {
        let base64Audio = g711Bytes.base64EncodedString()
        let event: [String: Any] = [
            "type": "input_audio_buffer.append",
            "audio": base64Audio
        ]
        sendMessage(json: event)
    }
    
    func sendToolOutput(toolCallId: String, output: String) {
        let event: [String: Any] = [
            "type": "conversation.item.create",
            "item": [
                "type": "function_call_output",
                "call_id": toolCallId,
                "output": output
            ]
        ]
        sendMessage(json: event)
        
        let createResponse: [String: Any] = [
            "type": "response.create"
        ]
        sendMessage(json: createResponse)
    }
    
    private func sendMessage(json: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: json, options: []),
              let string = String(data: data, encoding: .utf8) else { return }
        
        let message = URLSessionWebSocketTask.Message.string(string)
        webSocket?.send(message) { [weak self] error in
            if let error = error {
                self?.onError("Send error: \(error.localizedDescription)")
                print("Send error: \(error)")
            }
        }
    }
    
    func disconnect() {
        webSocket?.cancel(with: .normalClosure, reason: nil)
        webSocket = nil
    }
}
