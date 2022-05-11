// constants
const aesPassHash     = 'SHA-256'; // for 256 bit AES key
const ecdhCurve       = 'P-521';
const ivLength        = 16;        // 128 bit
const pbkdf2AesHash   = 'SHA-512';
const pbkdf2AesLength = 256;       // 256 bit
const rsaOaepHash     = 'SHA-512';

// PEM format
export function pemExport(key) {
	return new Promise((resolve,reject) => {
		const isPrivate = key.type === 'private';
		const keyName   = isPrivate ? 'PRIVATE' : 'PUBLIC';
		const protocol  = isPrivate ? 'pkcs8'   : 'spki';
		
		crypto.subtle.exportKey(protocol,key).then(
			res => {
				const keyBase64 = window.btoa(
					String.fromCharCode.apply(null,new Uint8Array(res)));
				
				resolve(`-----BEGIN ${keyName} KEY-----\n${keyBase64}\n-----END ${keyName} KEY-----`);
			},
			err => reject(err)
		);
	});
};
export function pemImport(pem,mode,exportable) {
	
	// strip newlines & pre/postfixes
    const byteString = window.atob(
		pem.replace('\n','')
			.replace(/-{5}(BEGIN|END)\s(PRIVATE|PUBLIC)\sKEY-{5}/g,'')
	);
	
    let byteArray = new Uint8Array(byteString.length);
    for(let i = 0; i < byteString.length; i++) {
        byteArray[i] = byteString.charCodeAt(i);
    }
    
	const isPrivate = pem.includes('PRIVATE');
	
	let uses = isPrivate ? ['decrypt'] : ['encrypt'];
	let algo = { name:'RSA-OAEP', hash:rsaOaepHash };
	
	if(mode === 'ECDH') {
		uses = isPrivate ? ['deriveKey'] : [];
		algo = { name:'ECDH', namedCurve:ecdhCurve };
	}
	
	return crypto.subtle.importKey(
		isPrivate ? 'pkcs8' : 'spki',
		byteArray,
		algo,
		exportable,
		uses
	);
};

// AES
export function aesGcmDecryptBase64(ciphertext,key) {
	return new Promise((resolve,reject) => {
		const ivStr = atob(ciphertext).slice(0,ivLength); // decode base64 iv
		const ctStr = atob(ciphertext).slice(ivLength);   // decode base64 ciphertext
		
		crypto.subtle.decrypt(
			{ name:'AES-GCM', iv:stringToUint8Array(ivStr) },
			key,
			stringToUint8Array(ctStr)
		).then(
			res => resolve(new TextDecoder().decode(res)),
			err => reject(err)
		);
	});
};
export async function aesGcmDecryptBase64WithPhrase(ciphertext,passphrase) {
	return new Promise((resolve,reject) => {
		
		// hash the passphrase
	    crypto.subtle.digest(
			aesPassHash,
			(new TextEncoder().encode(passphrase))
		).then(
			hash => {
				const ivStr = atob(ciphertext).slice(0,ivLength); // decode base64 iv
				const ctStr = atob(ciphertext).slice(ivLength);   // decode ciphertext
				const iv    = stringToUint8Array(ivStr);
				const algo = { name:'AES-GCM', iv:iv };
				
				// use hashed passphrase as AES key
				crypto.subtle.importKey(
					'raw',
					hash,
					algo,
					false,
					['decrypt']
				).then(
					key => {
						crypto.subtle.decrypt(
							algo,
							key,
							stringToUint8Array(ctStr)
						).then(
							res => resolve(new TextDecoder().decode(res)),
							err => reject(err)
						);
					}
				);
			},
			err => reject(err)
		);
	});
};
export function aesGcmEncryptBase64(plaintext,key) {
	return new Promise((resolve,reject) => {
	    const iv = ivGenerate(ivLength);                // generate new iv
	    const pt = new TextEncoder().encode(plaintext); // encode plaintext as UTF-8
		
	    crypto.subtle.encrypt(
			{ name:'AES-GCM', iv:iv },
			key,
			pt
		).then(
			res => resolve(btoa(ivToString(iv)+arrayBufferToString(res))), // encode iv+ciphertext as base64
			err => reject(err)
		);
	});
};
export function aesGcmEncryptBase64WithPhrase(plaintext,passphrase) {
	return new Promise((resolve,reject) => {
		
		// hash the passphrase
	    crypto.subtle.digest(
			aesPassHash,
			(new TextEncoder().encode(passphrase))
		).then(
			hash => {
				const iv   = ivGenerate(ivLength);
				const algo = { name:'AES-GCM', iv:iv };
				
				// use hashed passphrase as AES key
				crypto.subtle.importKey(
					'raw',
					hash,
					algo,
					false,
					['encrypt']
				).then(
					key => {
						// encrypt plaintext using AES key
						crypto.subtle.encrypt(
							algo,
							key,
							(new TextEncoder().encode(plaintext))
						).then(
							res => {
								// encode iv+ciphertext as base64
								resolve(btoa(ivToString(iv)+arrayBufferToString(res)));
							}
						);
					}
				);
			},
			err => reject(err)
		);
	});
};
export function aesGcmExportBase64(key) {
	return new Promise((resolve,reject) => {
		crypto.subtle.exportKey('raw',key).then(
			res => resolve(btoa(arrayBufferToString(res))),
			err => reject(err)
		);
	});
};
export function aesGcmImportBase64(keyBase64) {
	return crypto.subtle.importKey(
		'raw',
		stringToUint8Array(atob(keyBase64)),
		{name:'AES-GCM'},
		false,
		['encrypt','decrypt']
	);
};

// RSA
export function rsaGenerateKeys(exportable,len) {
	return crypto.subtle.generateKey(
		{
			name:'RSA-OAEP',
			modulusLength:len,
			publicExponent:new Uint8Array([0x01,0x00,0x01]),
			hash:{name:rsaOaepHash},
		},
		exportable,
		['encrypt','decrypt']
	);
};
export function rsaEncrypt(publicKey,plaintext) {
	return new Promise((resolve,reject) => {
		window.crypto.subtle.encrypt(
			{ name:'RSA-OAEP' },
			publicKey,
			(new TextEncoder().encode(plaintext))
		).then(
			res => resolve(btoa(arrayBufferToString(res))),
			err => reject(err)
		);
	});
};
export function rsaDecrypt(privateKey,cipherBase64) {
	return new Promise((resolve,reject) => {
		window.crypto.subtle.decrypt(
			{ name:'RSA-OAEP' },
			privateKey,
			stringToUint8Array(atob(cipherBase64))
		).then(
			res => resolve(new TextDecoder().decode(res)),
			err => reject(err)
		);
	});
};

// PBKDF2
export function pbkdf2DeriveAesGcmKey(salt,key,iterations,exportable){
	return crypto.subtle.deriveKey(
		{
			name:'PBKDF2',
			salt:stringToUint8Array(salt),
			iterations:iterations,
			hash:{name:pbkdf2AesHash}
		},
		key,
		{
			name:'AES-GCM',
			iv:ivGenerate(ivLength),
			length:pbkdf2AesLength
		},
		exportable,
		['encrypt','decrypt']
	);
};
export function pbkdf2ImportKey(passphrase) {
	return crypto.subtle.importKey(
		'raw',
		(new TextEncoder().encode(passphrase)),
		{name:'PBKDF2'},
		false,
		['deriveKey']
	);
};
export function pbkdf2PassToAesGcmKey(passphrase,salt,iterations,exportable) {
	return new Promise((resolve,reject) => {
		pbkdf2ImportKey(passphrase).then(
			res => resolve(pbkdf2DeriveAesGcmKey(salt,res,iterations,exportable)),
			err => reject(err)
		);
	});
};

// helpers
export function getRandomString(len) {
	let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!"§$%&/()=?_-:;#*+<>';
	let arr   = new Uint32Array(len);
	let out   = '';
	crypto.getRandomValues(arr);
	for(let i = 0; i < len; i++) {
		out += chars[arr[i] % chars.length];
	}
	return out;
};
function arrayBufferToString(arrayBuffer) {
	const byteArray = Array.from(new Uint8Array(arrayBuffer));
	return byteArray.map(byte => String.fromCharCode(byte)).join('');
};
function ivGenerate(len) {
	return crypto.getRandomValues(new Uint8Array(len));
};
function ivToString(iv) {
	return Array.from(iv).map(b => String.fromCharCode(b)).join('');
};
function stringToUint8Array(v) {
	return new Uint8Array(Array.from(v).map(ch => ch.charCodeAt(0)));
};