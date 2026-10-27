// Circuit Studio behavioral peripheral lab; ATmega328P, 16 MHz. GPL-2.0-or-later.
#define F_CPU 16000000UL
#include <avr/io.h>
#include <util/delay.h>
#include <stdint.h>
volatile uint8_t eeprom_result,spi_result,ack_errors;
static void pause_bus(void){_delay_us(6);}
static void sda(uint8_t high){if(high)DDRC&=~_BV(4);else DDRC|=_BV(4);pause_bus();}
static void scl(uint8_t high){if(high){DDRC&=~_BV(5);while(!(PINC&_BV(5))){};}else DDRC|=_BV(5);pause_bus();}
static void start(void){sda(1);scl(1);sda(0);scl(0);}
static void stop(void){sda(0);scl(1);sda(1);}
static void write_byte(uint8_t b){for(uint8_t i=0;i<8;i++){sda(b&128);scl(1);scl(0);b<<=1;}sda(1);scl(1);if(PINC&_BV(4))ack_errors++;scl(0);}
static uint8_t read_byte(void){uint8_t v=0;sda(1);for(uint8_t i=0;i<8;i++){scl(1);v=(v<<1)|!!(PINC&_BV(4));scl(0);}sda(1);scl(1);scl(0);return v;}
static void uart(uint8_t b){PORTD&=~_BV(1);_delay_us(104);for(uint8_t i=0;i<8;i++){if(b&1)PORTD|=_BV(1);else PORTD&=~_BV(1);_delay_us(104);b>>=1;}PORTD|=_BV(1);_delay_us(104);}
static uint8_t spi(uint8_t b){uint8_t v=0;PORTB&=~_BV(2);pause_bus();for(uint8_t i=0;i<8;i++){if(b&128)PORTB|=_BV(3);else PORTB&=~_BV(3);pause_bus();PORTB|=_BV(5);pause_bus();v=(v<<1)|!!(PINB&_BV(4));PORTB&=~_BV(5);pause_bus();b<<=1;}PORTB|=_BV(2);return v;}
static void nibble(uint8_t n,uint8_t rs){PORTD=(PORTD&3)|(rs?8:0)|(n<<4);PORTD|=4;_delay_us(2);PORTD&=~4;_delay_us(45);}
static void lcd(uint8_t b,uint8_t rs){nibble(b>>4,rs);nibble(b&15,rs);}
int main(void){PORTD=2;DDRD=0xfe;PORTB=4;DDRB=0x2c;PORTC=0;DDRC=0;_delay_ms(5);
 nibble(3,0);_delay_ms(5);nibble(3,0);nibble(3,0);nibble(2,0);lcd(0x28,0);lcd(0x0c,0);lcd(1,0);_delay_ms(2);lcd(0x80,0);const char *text="Circuit Studio";while(*text)lcd(*text++,1);
 start();write_byte(0xa0);write_byte(0);write_byte(0);write_byte(0x5a);stop();_delay_ms(6);
 start();write_byte(0xa0);write_byte(0);write_byte(0);start();write_byte(0xa1);eeprom_result=read_byte();stop();
 lcd(0xc0,0);text=eeprom_result==0x5a?"EEPROM = 5A":"EEPROM failed";while(*text)lcd(*text++,1);
 start();write_byte(0x78);write_byte(0);write_byte(0xaf);write_byte(0x20);write_byte(0);write_byte(0x21);write_byte(0);write_byte(127);write_byte(0x22);write_byte(0);write_byte(7);stop();
 start();write_byte(0x78);write_byte(0x40);for(uint8_t i=0;i<128;i++)write_byte(i&1?0xaa:0x55);stop();
 spi_result=spi(0x3c);spi(0x96);uart(ack_errors?'E':'O');uart(spi_result==0xa5?'K':'F');while(1){}
}
