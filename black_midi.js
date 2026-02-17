class IndexedDBStorage {
    constructor() {
        this.dbName = 'CDBMC_VideoDB';
        this.dbVersion = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('videos')) {
                    db.createObjectStore('videos', { keyPath: 'id' });
                }
            };
        });
    }

    async storeFile(id, file) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['videos'], 'readwrite');
            const store = transaction.objectStore('videos');
            const request = store.put({ id: id, file: file });

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getFile(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['videos'], 'readonly');
            const store = transaction.objectStore('videos');
            const request = store.get(id);

            request.onsuccess = () => {
                if (request.result) {
                    resolve(request.result.file);
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async deleteFile(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['videos'], 'readwrite');
            const store = transaction.objectStore('videos');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

class BlackMidiSystem {
    constructor() {
        // 确保只加载一次MIDI数据
        const storedVideos = localStorage.getItem('cdbmc_videos');
        this.videos = storedVideos ? this.removeDuplicateVideos(JSON.parse(storedVideos)) : [];
        this.messages = JSON.parse(localStorage.getItem('cdbmc_messages')) || [];
        this.currentUser = JSON.parse(localStorage.getItem('cdbmc_current_user')) || null;
        this.storage = new IndexedDBStorage();
        this.adminUsername = '咖咯德苏林';
        this.init();
    }

    async init() {
        try {
            await this.storage.init();
            this.loadVideos();
            this.updatePublishFormVisibility();
        } catch (error) {
            console.error('IndexedDB初始化失败:', error);
        }
    }

    async publishVideo(videoFile, audioFile, midiFile, title) {
        if (!this.currentUser) {
            alert('请先登录！');
            return;
        }

        if (!midiFile || !title) {
            alert('请填写完整信息！');
            return;
        }

        const fileName = midiFile.name.toLowerCase();
        const allowedExtensions = ['.mid', '.zip', '.rar'];
        const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));

        if (!hasValidExtension) {
            alert('文件格式不正确！只支持.mid、.zip、.rar格式的文件。');
            return;
        }

        const maxMidiSize = 150 * 1024 * 1024;

        if (midiFile.size > maxMidiSize) {
            alert('MIDI文件不能超过150MB！');
            return;
        }

        if (videoFile) {
            const videoFileName = videoFile.name.toLowerCase();
            const allowedVideoExtensions = ['.mp4', '.mov', '.webm'];
            const hasValidVideoExtension = allowedVideoExtensions.some(ext => videoFileName.endsWith(ext));

            if (!hasValidVideoExtension) {
                alert('视频格式不正确！只支持.mp4、.mov、.webm格式的文件。');
                return;
            }

            const maxVideoSize = 150 * 1024 * 1024;
            if (videoFile.size > maxVideoSize) {
                alert('视频文件不能超过150MB！');
                return;
            }
        }

        if (audioFile) {
            const audioFileName = audioFile.name.toLowerCase();
            const allowedAudioExtensions = ['.mp3', '.wav', '.flac'];
            const hasValidAudioExtension = allowedAudioExtensions.some(ext => audioFileName.endsWith(ext));

            if (!hasValidAudioExtension) {
                alert('音频格式不正确！只支持.mp3、.wav、.flac格式的文件。');
                return;
            }

            const maxAudioSize = 50 * 1024 * 1024;
            if (audioFile.size > maxAudioSize) {
                alert('音频文件不能超过50MB！');
                return;
            }
        }

        const videoId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
        const videoData = {
            id: videoId,
            title: title,
            username: this.currentUser.username,
            videoId: videoFile ? videoId + '_video' : null,
            audioId: audioFile ? videoId + '_audio' : null,
            midiId: videoId + '_midi',
            likes: [],
            createdAt: new Date().toISOString(),
            status: 'approved'
        };

        try {
            if (videoFile) {
                await this.storage.storeFile(videoId + '_video', videoFile);
            }
            if (audioFile) {
                await this.storage.storeFile(videoId + '_audio', audioFile);
            }
            await this.storage.storeFile(videoId + '_midi', midiFile);

            this.videos.push(videoData);
            this.saveVideos();
            this.addVideoToUI(videoData, videoFile, audioFile, midiFile);
            alert('发布成功！');
        } catch (error) {
            console.error('文件存储失败:', error);
            alert('发布失败，请重试！');
        }
    }

    async loadVideos() {
        const container = document.getElementById('black_midi');
        if (!container) return;

        container.innerHTML = '';

        if (this.videos.length === 0) {
            container.innerHTML = '<p>暂无黑乐谱MIDI</p>';
            return;
        }

        const uniqueVideos = this.removeDuplicateVideos(this.videos);
        const sortedVideos = uniqueVideos.sort((a, b) => {
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        for (const video of sortedVideos) {
            // 只显示已审核的视频
            if (video.status !== 'approved') {
                continue;
            }
            
            const midiFile = await this.storage.getFile(video.midiId);
            let videoFile = null;
            let audioFile = null;
            if (video.videoId) {
                videoFile = await this.storage.getFile(video.videoId);
            }
            if (video.audioId) {
                audioFile = await this.storage.getFile(video.audioId);
            }

            if (midiFile) {
                const videoElement = await this.createVideoElement(video, videoFile, audioFile, midiFile);
                container.appendChild(videoElement);
            }
        }
    }

    updatePublishFormVisibility() {
        const publishForm = document.getElementById('publish_form');
        if (publishForm) {
            if (this.currentUser) {
                publishForm.style.display = 'block';
                const loginPrompt = publishForm.querySelector('.login-prompt');
                if (loginPrompt) {
                    loginPrompt.remove();
                }
                
                const inputs = publishForm.querySelectorAll('input, button');
                inputs.forEach(input => {
                    input.disabled = false;
                });
            } else {
                publishForm.style.display = 'block';
                const loginPrompt = publishForm.querySelector('.login-prompt');
                if (!loginPrompt) {
                    const promptElement = document.createElement('p');
                    promptElement.className = 'login-prompt';
                    promptElement.style.cssText = 'color: #f44336; font-weight: bold; margin-bottom: 10px;';
                    promptElement.textContent = '你需要登录/注册账号才可以发布Midi。';
                    publishForm.insertBefore(promptElement, publishForm.firstChild);
                }
                
                const inputs = publishForm.querySelectorAll('input, button');
                inputs.forEach(input => {
                    input.disabled = true;
                });
            }
        }
    }

    async addVideoToUI(video, videoFile, audioFile, midiFile) {
        const container = document.getElementById('black_midi');
        if (!container) return;

        const noVideosMessage = container.querySelector('p');
        if (noVideosMessage && noVideosMessage.textContent === '暂无黑乐谱MIDI') {
            container.innerHTML = '';
        }

        const videoElement = await this.createVideoElement(video, videoFile, audioFile, midiFile);
        container.insertBefore(videoElement, container.firstChild);
    }

    removeDuplicateVideos(videos) {
        const videoMap = new Map();
        
        videos.forEach(video => {
            if (videoMap.has(video.id)) {
                const existingVideo = videoMap.get(video.id);
                const existingTime = new Date(existingVideo.createdAt).getTime();
                const currentTime = new Date(video.createdAt).getTime();
                
                if (currentTime < existingTime) {
                    videoMap.set(video.id, video);
                }
            } else {
                videoMap.set(video.id, video);
            }
        });
        
        return Array.from(videoMap.values());
    }

    async createVideoElement(video, videoFile, audioFile, midiFile) {
        const container = document.createElement('div');
        container.style.cssText = 'flex: 0 0 auto; width: 350px; border: 1px solid #ccc; margin-right: 0; padding: 10px; position: relative; background-color: white; border-radius: 5px;';

        if (videoFile) {
            const videoElement = document.createElement('video');
            videoElement.src = URL.createObjectURL(videoFile);
            videoElement.style.cssText = 'width: 100%; height: 200px; object-fit: cover; margin-bottom: 10px;';
            videoElement.controls = true;
            container.appendChild(videoElement);
        }

        if (audioFile) {
            const audioElement = document.createElement('audio');
            audioElement.src = URL.createObjectURL(audioFile);
            audioElement.style.cssText = 'width: 100%; margin-bottom: 10px;';
            audioElement.controls = true;
            container.appendChild(audioElement);
        }

        const titleElement = document.createElement('h3');
        titleElement.textContent = video.title;
        titleElement.style.cssText = 'font-size: 16px; margin: 10px 0 5px 0;';

        const allUsers = this.getAllUsers();
        const userExists = allUsers[video.username];
        const displayUsername = userExists ? video.username : '账户已注销';

        const usernameElement = document.createElement('p');
        usernameElement.textContent = `发布者: ${displayUsername}`;
        usernameElement.style.cssText = 'font-size: 14px; margin: 5px 0;';
        if (!userExists) {
            usernameElement.style.color = '#999';
        }

        const timeElement = document.createElement('p');
        const publishTime = new Date(video.createdAt);
        timeElement.textContent = `发布时间: ${publishTime.toLocaleString('zh-CN')}`;
        timeElement.style.cssText = 'color: #666; font-size: 12px; margin: 5px 0;';

        const idElement = document.createElement('p');
        idElement.textContent = `ID: ${video.id}`;
        idElement.style.cssText = 'color: #999; font-size: 10px; margin: 5px 0;';

        const copyIdButton = document.createElement('button');
        copyIdButton.textContent = '复制MIDI ID';
        copyIdButton.style.cssText = 'font-size: 10px; padding: 2px 5px; margin-left: 5px;';
        copyIdButton.onclick = () => {
            navigator.clipboard.writeText(video.id).then(() => {
                alert('MIDI ID已复制到剪贴板！');
            }).catch(() => {
                const textarea = document.createElement('textarea');
                textarea.value = video.id;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                alert('MIDI ID已复制到剪贴板！');
            });
        };
        idElement.appendChild(copyIdButton);

        const downloadButton = document.createElement('button');
        downloadButton.textContent = '下载Midi';
        downloadButton.style.cssText = 'margin-top: 10px;';
        downloadButton.onclick = () => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(midiFile);
            
            const fileName = video.title.toLowerCase();
            let extension = '.mid';
            if (fileName.endsWith('.zip')) {
                extension = '.zip';
            } else if (fileName.endsWith('.rar')) {
                extension = '.rar';
            }
            
            link.download = `${video.title}${extension}`;
            link.click();
        };

        if (audioFile) {
            const downloadAudioButton = document.createElement('button');
            downloadAudioButton.textContent = '下载音频';
            downloadAudioButton.style.cssText = 'margin-top: 10px;';
            downloadAudioButton.onclick = () => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(audioFile);
                
                const audioFileName = video.title.toLowerCase();
                let audioExtension = '.mp3';
                if (audioFileName.endsWith('.wav')) {
                    audioExtension = '.wav';
                } else if (audioFileName.endsWith('.flac')) {
                    audioExtension = '.flac';
                }
                
                link.download = `${video.title}${audioExtension}`;
                link.click();
            };
            container.appendChild(downloadAudioButton);
        }

        container.appendChild(downloadButton);

        const likeCountElement = document.createElement('span');
        likeCountElement.textContent = `❤️ ${video.likes.length}`;
        likeCountElement.style.cssText = 'position: absolute; bottom: 10px; right: 10px; font-size: 14px;';

        const actionsDiv = document.createElement('div');
        actionsDiv.style.cssText = 'position: absolute; top: 10px; right: 10px;';

        if (this.currentUser && this.currentUser.username === video.username) {
            const deleteButton = document.createElement('button');
            deleteButton.textContent = '删除';
            deleteButton.onclick = () => this.deleteVideo(video.id);
            actionsDiv.appendChild(deleteButton);
        } else if (this.currentUser) {
            const likeButton = document.createElement('button');
            const hasLiked = video.likes.includes(this.currentUser.username);
            likeButton.textContent = hasLiked ? '已点赞' : '点赞';
            likeButton.onclick = () => this.likeVideo(video.id);
            actionsDiv.appendChild(likeButton);
        }

        container.appendChild(titleElement);
        container.appendChild(usernameElement);
        container.appendChild(timeElement);
        container.appendChild(idElement);
        container.appendChild(downloadButton);
        container.appendChild(likeCountElement);
        container.appendChild(actionsDiv);

        return container;
    }

    async deleteVideo(videoId) {
        if (!confirm('确定要删除这个MIDI吗？')) {
            return;
        }

        const videoIndex = this.videos.findIndex(v => v.id === videoId);
        if (videoIndex !== -1) {
            const video = this.videos[videoIndex];

            try {
                if (video.videoId) {
                    await this.storage.deleteFile(video.videoId);
                }
                if (video.audioId) {
                    await this.storage.deleteFile(video.audioId);
                }
                if (video.midiId) {
                    await this.storage.deleteFile(video.midiId);
                }

                this.videos.splice(videoIndex, 1);
                this.saveVideos();
                this.loadVideos();
                alert('删除成功！');
            } catch (error) {
                console.error('删除失败:', error);
                alert('删除失败，请重试！');
            }
        }
    }

    likeVideo(videoId) {
        if (!this.currentUser) {
            alert('请先登录！');
            return;
        }

        const video = this.videos.find(v => v.id === videoId);
        if (!video) return;

        if (video.username === this.currentUser.username) {
            alert('不能给自己点赞！');
            return;
        }

        const likeIndex = video.likes.indexOf(this.currentUser.username);
        if (likeIndex === -1) {
            video.likes.push(this.currentUser.username);
            this.addMessage(video.username, this.currentUser.username, video.title);
            alert('点赞成功！');
        } else {
            video.likes.splice(likeIndex, 1);
            alert('取消点赞！');
        }

        this.saveVideos();
        this.loadVideos();
    }

    addMessage(toUser, fromUser, videoTitle) {
        const message = {
            id: Date.now().toString(),
            toUser: toUser,
            fromUser: fromUser,
            videoTitle: videoTitle,
            createdAt: new Date().toISOString(),
            read: false
        };

        this.messages.push(message);
        this.saveMessages();
    }

    getMessages(username) {
        return this.messages.filter(m => m.toUser === username);
    }

    getAllUsers() {
        const users = localStorage.getItem('cdbmc_users');
        return users ? JSON.parse(users) : {};
    }

    async searchVideos(keyword) {
        if (!keyword || keyword.trim() === '') {
            this.loadVideos();
            return;
        }

        const container = document.getElementById('black_midi');
        if (!container) return;

        container.innerHTML = '';

        const filteredVideos = this.videos.filter(video => {
            return video.status === 'approved' && video.title.toLowerCase().includes(keyword.toLowerCase());
        });

        if (filteredVideos.length === 0) {
            container.innerHTML = '<p>未找到匹配的黑乐谱MIDI</p>';
            return;
        }

        const uniqueVideos = this.removeDuplicateVideos(filteredVideos);
        const sortedVideos = uniqueVideos.sort((a, b) => {
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        for (const video of sortedVideos) {
            const midiFile = await this.storage.getFile(video.midiId);
            let videoFile = null;
            let audioFile = null;
            if (video.videoId) {
                videoFile = await this.storage.getFile(video.videoId);
            }
            if (video.audioId) {
                audioFile = await this.storage.getFile(video.audioId);
            }

            if (midiFile) {
                const videoElement = await this.createVideoElement(video, videoFile, audioFile, midiFile);
                container.appendChild(videoElement);
            }
        }
    }

    async searchById() {
        const videoId = prompt('请输入MIDI ID：');
        if (!videoId || videoId.trim() === '') {
            return;
        }

        const container = document.getElementById('black_midi');
        if (!container) return;

        container.innerHTML = '';

        const video = this.videos.find(v => v.id === videoId);

        if (!video || video.status !== 'approved') {
            container.innerHTML = '<p>未找到该MIDI</p>';
            return;
        }

        const midiFile = await this.storage.getFile(video.midiId);
        let videoFile = null;
        let audioFile = null;
        if (video.videoId) {
            videoFile = await this.storage.getFile(video.videoId);
        }
        if (video.audioId) {
            audioFile = await this.storage.getFile(video.audioId);
        }

        if (midiFile) {
            const videoElement = await this.createVideoElement(video, videoFile, audioFile, midiFile);
            container.appendChild(videoElement);
        }
    }

    markAsRead(messageId) {
        const message = this.messages.find(m => m.id === messageId);
        if (message) {
            message.read = true;
            this.saveMessages();
        }
    }

    saveVideos() {
        localStorage.setItem('cdbmc_videos', JSON.stringify(this.videos));
    }

    saveMessages() {
        localStorage.setItem('cdbmc_messages', JSON.stringify(this.messages));
    }
}

let blackMidiSystem;

async function initBlackMidiSystem() {
    if (blackMidiSystem) {
        return; // 防止重复初始化
    }
    
    blackMidiSystem = new BlackMidiSystem();
    await blackMidiSystem.init();
}

function publishVideo() {
    if (!blackMidiSystem) {
        alert('系统正在初始化，请稍后再试！');
        return;
    }

    const midiFile = document.getElementById('midi_file').files[0];
    const title = document.getElementById('video_title').value;
    const videoFile = document.getElementById('video_file').files[0];
    const audioFile = document.getElementById('audio_file').files[0];

    blackMidiSystem.publishVideo(videoFile, audioFile, midiFile, title);

    document.getElementById('midi_file').value = '';
    document.getElementById('video_title').value = '';
    document.getElementById('video_file').value = '';
    document.getElementById('audio_file').value = '';
}

function showMessages() {
    if (!blackMidiSystem.currentUser) {
        alert('请先登录！');
        return;
    }

    const modal = document.getElementById('messages_modal');
    const messagesList = document.getElementById('messages_list');
    const messages = blackMidiSystem.getMessages(blackMidiSystem.currentUser.username);

    messagesList.innerHTML = '';

    if (messages.length === 0) {
        messagesList.innerHTML = '<p>暂无消息</p>';
    } else {
        messages.forEach(message => {
            const messageElement = document.createElement('div');
            messageElement.style.cssText = 'border: 1px solid #eee; padding: 10px; margin-bottom: 10px; background-color: ' + (message.read ? '#f9f9f9' : '#fff9c4') + ';';
            messageElement.textContent = `MIDI《${message.videoTitle}》被 ${message.fromUser} 点赞`;
            messageElement.onclick = () => {
                blackMidiSystem.markAsRead(message.id);
                messageElement.style.backgroundColor = '#f9f9f9';
            };
            messagesList.appendChild(messageElement);
        });
    }

    modal.style.display = 'block';
}

function closeMessages() {
    document.getElementById('messages_modal').style.display = 'none';
}

function searchVideos() {
    const searchInput = document.getElementById('search_input');
    if (searchInput) {
        blackMidiSystem.searchVideos(searchInput.value);
    }
}

function searchById() {
    blackMidiSystem.searchById();
}

function cleanDuplicateVideos() {
    const uniqueVideos = blackMidiSystem.removeDuplicateVideos(blackMidiSystem.videos);
    blackMidiSystem.videos = uniqueVideos;
    blackMidiSystem.saveVideos();
    blackMidiSystem.loadVideos();
}

function viewVideosData() {
    const videos = JSON.parse(localStorage.getItem('cdbmc_videos')) || [];
    console.log('当前MIDI数据:', videos);
    alert('MIDI数据已输出到控制台，请按F12查看！');
}

function clearAllVideos() {
    if (confirm('确定要清空所有MIDI吗？此操作不可撤销！')) {
        localStorage.removeItem('cdbmc_videos');
        if (blackMidiSystem) {
            blackMidiSystem.videos = [];
            blackMidiSystem.loadVideos();
        }
        alert('所有MIDI已清空！');
    }
}

// 将所有函数暴露到全局作用域
window.publishVideo = publishVideo;
window.showMessages = showMessages;
window.closeMessages = closeMessages;
window.searchVideos = searchVideos;
window.searchById = searchById;
window.cleanDuplicateVideos = cleanDuplicateVideos;
window.clearAllVideos = clearAllVideos;
window.viewVideosData = viewVideosData;