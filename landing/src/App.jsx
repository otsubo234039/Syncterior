import Header from './sections/Header.jsx'
import Hero from './sections/Hero.jsx'
import Features from './sections/Features.jsx'
import Steps from './sections/Steps.jsx'
import UseCases from './sections/UseCases.jsx'
import Faq from './sections/Faq.jsx'
import Footer from './sections/Footer.jsx'

export default function App() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Features />
        <Steps />
        <UseCases />
        <Faq />
      </main>
      <Footer />
    </>
  )
}