import React, { ChangeEvent, FormEvent } from 'react';
import { FaTwitter, FaFacebookF, FaInstagram, FaYoutube } from 'react-icons/fa';

const Footer: React.FC = () => {
  const [name, setName] = React.useState<string>('');
  const [email, setEmail] = React.useState<string>('');

  const handleSubscribe = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('Subscribing:', { name, email });
    setName('');
    setEmail('');
  };

  return (
    <footer className='bg-blue-900 text-white'>
      <div className='bg-blue-900 p-10 grid grid-cols-1 md:grid-cols-4 gap-8'>
        <div>
          <img src="/images/logo2.jpg" alt="Logo" className="mb-4" />
          <p className="mb-4">Empowering children through education</p>
          <div className='flex gap-4 text-xl'>
            <FaTwitter className="hover:text-blue-500 cursor-pointer" />
            <FaFacebookF className="hover:text-blue-600 cursor-pointer" />
            <FaInstagram className="hover:text-pink-500 cursor-pointer" />
            <FaYoutube className="hover:text-red-600 cursor-pointer" />
          </div>
        </div>

        <div>
          <h2 className="font-bold text-lg mb-3">Quick Links</h2>
          <ul className='space-y-1'>
            <li><a href="#home" className="hover:text-blue-400 transition">Home</a></li>
            <li><a href="#about" className="hover:text-blue-400 transition">About</a></li>
            <li><a href="#impact" className="hover:text-blue-400 transition">Impact</a></li>
            <li><a href="#courses" className="hover:text-blue-400 transition">Courses</a></li>
            <li><a href="#involved" className="hover:text-blue-400 transition">Get Involved</a></li>
            <li><a href="#contact" className="hover:text-blue-400 transition">Contact</a></li>
          </ul>
        </div>

        <div>
          <h2 className="font-bold text-lg mb-3">Contact Us</h2>
          <p><a href="https://codecircle.org" className="hover:text-blue-400">Codecircle.org</a></p>
          <p>Email: <a href="mailto:support@codecircle.org" className="hover:text-blue-400">support@codecircle.org</a></p>
        </div>

        <div>
          <h2 className="font-bold text-lg mb-3">Subscribe to our Newsletter</h2>
          <form onSubmit={handleSubscribe}>
            <input 
              type="text" 
              placeholder="Your name" 
              aria-label="Your name" 
              className="w-full mb-2 p-2 border rounded text-gray-800" 
              value={name} 
              onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)} 
            />
            <input 
              type="email" 
              placeholder="Your email" 
              aria-label="Your email" 
              className="w-full mb-2 p-2 border rounded text-gray-800" 
              value={email} 
              onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} 
            />
            <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
              Subscribe
            </button>
          </form>
        </div>
      </div>

      <div className='border-t-2 border-gray-700 h-[80px] flex flex-col items-center justify-center text-sm text-white gap-2'>
        <p>© 2025 Codecircle.org. All rights reserved</p>
        <p>
          Privacy Policy | Terms of Service
        </p>
      </div>
    </footer>
  );
}

export default Footer;
