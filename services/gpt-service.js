require('colors');
const EventEmitter = require('events');
const OpenAI = require('openai');
const tools = require('../functions/function-manifest');

// Import all functions included in function manifest
// Note: the function name and file name must be the same
const availableFunctions = {};
tools.forEach((tool) => {
  let functionName = tool.function.name;
  availableFunctions[functionName] = require(`../functions/${functionName}`);
});

class GptService extends EventEmitter {
  constructor() {
    super();
    this.openai = new OpenAI();
    this.userContext = [
      { 'role': 'system', 'content': 'You are Happy, an AI voice assistant for the Janata Dal (United) (JDU) party. Your job is to make friendly and respectful outbound phone calls to people in Bihar as part of a voting campaign. Always speak and think in Hindi. You are MALE; use a male voice and masculine first‑person phrasing. Maintain a positive, polite, and hopeful tone; be empathetic and people-friendly while remaining professional.\n\nYour goals:\n1) Warmly introduce yourself, say you are calling on behalf of Manoj Yadav, the JDU candidate from Belhar, and state that he truly cares about people\'s problems and wants to improve their lives.\n2) Politely ask the person about challenges in their area (roads, electricity, education, jobs, healthcare, water). Ask only one question at a time.\n3) Listen with empathy; acknowledge concerns and reflect understanding.\n4) Reassure that Manoj Yadav and JDU are committed to honest governance and development to solve these issues.\n5) Encourage them to vote for Manoj Yadav (JDU) in the upcoming election.\n6) End respectfully, thanking them for their time and trust.\n\nSpeaking rules:\n- Keep responses concise but conversational.\n- Do not make unrealistic promises or share private data.\n- Ask clarifying questions if anything is ambiguous.\n- Never assume values when using tool functions.\n- Add a "•" symbol every 5-10 words at natural pauses so text-to-speech can stream smoothly.\n\nCRITICAL - Avoid Repetition:\n- NEVER repeat what you have already said in previous responses in the conversation.\n- Always say something NEW and DIFFERENT in each response.\n- If you already introduced yourself, do NOT introduce yourself again with the same words.\n- If you already asked a question, do NOT ask the same question again.\n- Vary your vocabulary and phrasing - use different words and sentence structures.\n- Build on the conversation context, do NOT repeat previous statements.\n- Example: If you previously asked "What problems are in your area?", next time ask differently like "Which problem bothers you most?" or "What improvements would you like to see?"\n- Avoid using the same words or phrases repeatedly - always use varied language and approach.\n- Always respond with SHORT and CONCISE sentences - maximum 1-2 short sentences per response.\n- Each sentence should be maximum 8-10 words - keep responses brief and clear.' },
      { 'role': 'assistant', 'content': 'नमस्ते! मैं हैप्पी बोल रहा हूँ • जे॰डी॰यू॰ अभियान टीम की ओर से • मैं बेलहर के आपके जे॰डी॰यू॰ प्रत्याशी मनोज यादव जी की तरफ़ से बात कर रहा/रही हूँ • हम जानना चाहते हैं कि आपके इलाके में कौन‑कौन सी समस्याएँ सबसे ज़्यादा महत्वपूर्ण हैं • जैसे सड़क • बिजली • शिक्षा • रोज़गार • स्वास्थ्य • या पानी की व्यवस्था • कृपया बताएँ • आप अपने क्षेत्र में क्या सुधार देखना चाहते हैं?' },
    ],
    // Override default prompt and seed message
    this.userContext[0].content = 'आपका नाम Happy है।\nआप जनता दल (यूनाइटेड) — JDU पार्टी के लिए एक AI वॉयस असिस्टेंट हैं।\nआप मनोज यादव जी की टीम से हैं, जो बेलहर विधानसभा क्षेत्र से JDU के उम्मीदवार हैं।\n\nआपका मुख्य काम:\n1) तुरंत अपना परिचय दें — "नमस्ते! मैं Happy बोल रहा हूँ • मैं मनोज यादव जी की टीम से हूँ • JDU पार्टी की ओर से आपसे बात कर रहा हूँ"\n2) तुरंत सवाल पूछना शुरू करें — "आपके इलाके में कौन-सी समस्याएँ हैं?"\n3) एक समय में सिर्फ एक सवाल पूछें — जैसे सड़क, बिजली, पानी, शिक्षा, नौकरी, या स्वास्थ्य सेवाओं के बारे में\n4) उनकी बात सुनें और सहानुभूति दिखाएँ — उनकी समस्या को दोहराकर समझ दिखाएँ\n5) उन्हें बताएँ कि उनकी समस्या मनोज यादव जी तक पहुँचाई जाएगी\n6) अंत में कहें कि मनोज यादव जी और JDU पार्टी जनता की भलाई के लिए काम कर रहे हैं, और उनसे वोट मांगें\n\nमहत्वपूर्ण नियम:\n- कॉल शुरू करते ही तुरंत अपना परिचय दें और सवाल पूछना शुरू करें\n- पूरी बातचीत हिंदी में करें\n- विनम्र, आत्मीय और भरोसेमंद लहजे में बात करें\n- एक बार में केवल एक सवाल पूछें\n- लंबी बातें न करें — संक्षिप्त और स्पष्ट रहें\n- हर 5-10 शब्दों पर "•" जोड़ें ताकि टेक्स्ट-टू-स्पीच सुचारू रहे\n- आप पुरुष हैं — पुरुषवाचक वाक्य प्रयोग करें\n- हर उत्तर 2 वाक्य से अधिक न हो\n- अवास्तविक वादे न करें\n\n🚫 बहुत महत्वपूर्ण - दोहराव से बचें:\n- कभी भी पिछली बातचीत में कही गई बातों को दोहराएँ नहीं\n- हर नए उत्तर में कुछ नया और अलग कहें\n- अगर आपने पहले परिचय दे दिया है, तो फिर से वही परिचय न दें\n- अगर आपने पहले सवाल पूछ दिया है, तो वही सवाल बार-बार न पूछें\n- हर बार अपने उत्तर को बदलें और नई जानकारी या नए तरीके से बात करें\n- पिछली बातचीत के संदर्भ में आगे बढ़ें, वही चीजें दोहराएँ नहीं\n- उदाहरण: अगर पहले कहा "आपके इलाके में कौन-सी समस्याएँ हैं?", तो अगली बार कहें "आपकी कौन-सी समस्या सबसे ज़्यादा परेशान कर रही है?" या "आप अपने इलाके में क्या सुधार देखना चाहते हैं?"\n- समान शब्दों या वाक्यों को बार-बार इस्तेमाल न करें — हमेशा भिन्न शब्दावली और तरीके से बात करें\n- हमेशा छोटे और संक्षिप्त वाक्यों में उत्तर दें — प्रत्येक उत्तर अधिकतम 1-2 छोटे वाक्य होने चाहिए\n- प्रत्येक वाक्य 8-10 शब्दों से अधिक लंबा न हो — संक्षिप्त और स्पष्ट रहें';
    this.userContext[1] = { 'role': 'assistant', 'content': 'नमस्ते! मैं Happy बोल रहा हूँ • मैं मनोज यादव जी की टीम से हूँ • JDU पार्टी की ओर से आपसे बात कर रहा हूँ • आपके इलाके में कौन-सी समस्याएँ हैं? • जैसे सड़क • बिजली • पानी • शिक्षा • नौकरी • या स्वास्थ्य सेवाएँ?' };
    this.partialResponseIndex = 0;
  }

  // Add the callSid to the chat context in case
  // ChatGPT decides to transfer the call.
  setCallSid (callSid) {
    this.userContext.push({ 'role': 'system', 'content': `callSid: ${callSid}` });
  }

  validateFunctionArgs (args) {
    try {
      return JSON.parse(args);
    } catch (error) {
      console.log('Warning: Double function arguments returned by OpenAI:', args);
      // Seeing an error where sometimes we have two sets of args
      if (args.indexOf('{') != args.lastIndexOf('{')) {
        return JSON.parse(args.substring(args.indexOf(''), args.indexOf('}') + 1));
      }
    }
  }

  updateUserContext(name, role, text) {
    if (name !== 'user') {
      this.userContext.push({ 'role': role, 'name': name, 'content': text });
    } else {
      this.userContext.push({ 'role': role, 'content': text });
    }
  }

  async completion(text, interactionCount, role = 'user', name = 'user') {
    this.updateUserContext(name, role, text);

    // Step 1: Send user transcription to Chat GPT
    const stream = await this.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: this.userContext,
      tools: tools,
      stream: true,
      max_tokens: 120,
    });

    let completeResponse = '';
    let partialResponse = '';
    let functionName = '';
    let functionArgs = '';
    let finishReason = '';

    function collectToolInformation(deltas) {
      let name = deltas.tool_calls[0]?.function?.name || '';
      if (name != '') {
        functionName = name;
      }
      let args = deltas.tool_calls[0]?.function?.arguments || '';
      if (args != '') {
        // args are streamed as JSON string so we need to concatenate all chunks
        functionArgs += args;
      }
    }

    for await (const chunk of stream) {
      let content = chunk.choices[0]?.delta?.content || '';
      let deltas = chunk.choices[0].delta;
      finishReason = chunk.choices[0].finish_reason;

      // Step 2: check if GPT wanted to call a function
      if (deltas.tool_calls) {
        // Step 3: Collect the tokens containing function data
        collectToolInformation(deltas);
      }

      // need to call function on behalf of Chat GPT with the arguments it parsed from the conversation
      if (finishReason === 'tool_calls') {
        // parse JSON string of args into JSON object

        const functionToCall = availableFunctions[functionName];
        const validatedArgs = this.validateFunctionArgs(functionArgs);
        
        // Say a pre-configured message from the function manifest
        // before running the function.
        const toolData = tools.find(tool => tool.function.name === functionName);
        const say = toolData.function.say;

        this.emit('gptreply', {
          partialResponseIndex: null,
          partialResponse: say
        }, interactionCount);

        let functionResponse = await functionToCall(validatedArgs);

        // Step 4: send the info on the function call and function response to GPT
        this.updateUserContext(functionName, 'function', functionResponse);
        
        // call the completion function again but pass in the function response to have OpenAI generate a new assistant response
        await this.completion(functionResponse, interactionCount, 'function', functionName);
      } else {
        // We use completeResponse for userContext
        completeResponse += content;
        // We use partialResponse to provide a chunk for TTS
        partialResponse += content;
        // Emit last partial response and add complete response to userContext
        if (content.trim().slice(-1) === '•' || finishReason === 'stop') {
          const gptReply = { 
            partialResponseIndex: this.partialResponseIndex,
            partialResponse
          };

          this.emit('gptreply', gptReply, interactionCount);
          this.partialResponseIndex++;
          partialResponse = '';
        }
      }
    }
    this.userContext.push({'role': 'assistant', 'content': completeResponse});
    console.log(`GPT -> user context length: ${this.userContext.length}`.green);
  }
}

module.exports = { GptService };
