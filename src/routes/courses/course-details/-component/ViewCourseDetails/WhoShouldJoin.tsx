import React from 'react'

const WhoShouldJoin:React.FC = () => {
  return (
    <div className=" p-8 flex ml-8 mr-8">
    <div className='left p-6  w-[60%] bg-white shadow-md'>
            <h1 className="text-2xl font-bold mb-4">Who should join?</h1>
            <p className="mb-4">
              This course is ideal for:
            </p>
            <ul className="list-disc list-inside space-y-2">
        <li>Children aged 7 and up who are curious about technology and love to create.</li>
        <li>Absolute beginners with no prior experience in coding or programming.</li>
        <li>Parents and teachers looking for a fun and educational way to introduce kids to coding.</li>
        <li>Young learners who enjoy storytelling, games, or animation and want to build their own.</li>
        <li>Homeschoolers and after-school program coordinators seeking a structured, hands-on learning resource.</li>
      </ul>
      <p className="mt-4">No programming knowledge is needed—just creativity, curiosity, and a desire to learn!</p>
         </div>   
        </div>
  )
}

export default WhoShouldJoin
