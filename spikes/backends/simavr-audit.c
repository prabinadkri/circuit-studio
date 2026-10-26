/* Read-only feasibility probe for separately installed simavr. GPL-3.0-or-later. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <simavr/sim_avr.h>
#include <simavr/sim_elf.h>
#include <simavr/avr_ioport.h>
#include <simavr/sim_io.h>
static avr_t *cpu;
static unsigned edges=0, bad=0, high=0, low=0, sample_count=0;
static uint64_t last=0, samples[12];
static int previous=-1;
static void pin(struct avr_irq_t *irq, uint32_t value, void *param) {
  int level=value&1;
  if(previous<0){previous=level;return;}
  if(level==previous)return;
  if(edges>0){uint64_t delta=cpu->cycle-last;if(previous){high=delta;if(delta!=4)bad++;}else{low=delta;if(delta!=5)bad++;}}
  if(sample_count<12)samples[sample_count++]=cpu->cycle;
  edges++;last=cpu->cycle;previous=level;
}
int main(int argc,char **argv){
 if(argc!=3)return 2;
 elf_firmware_t firmware={0};if(elf_read_firmware(argv[2],&firmware))return 2;
 cpu=avr_make_mcu_by_name(argv[1]);if(!cpu||avr_init(cpu))return 2;
 cpu->frequency=1000000;cpu->vcc=cpu->avcc=cpu->aref=5000;avr_load_firmware(cpu,&firmware);
 avr_irq_register_notify(avr_io_getirq(cpu,AVR_IOCTL_IOPORT_GETIRQ('B'),IOPORT_IRQ_PIN0),pin,NULL);
 avr_irq_t *input=avr_io_getirq(cpu,AVR_IOCTL_IOPORT_GETIRQ('A'),IOPORT_IRQ_PIN0);
 unsigned input_checks=0;
 for(unsigned change=0;change<100;change++){
  int level=change&1;avr_raise_irq(input,level);
  uint64_t end=cpu->cycle+500;
  while(cpu->cycle<end){int state=avr_run(cpu);if(state==cpu_Crashed||state==cpu_Done)return 3;}
  avr_ioport_state_t state={0};if(avr_ioctl(cpu,AVR_IOCTL_IOPORT_GETSTATE('C'),&state)||((state.port&1)!=level))return 4;
  input_checks++;
 }
 printf("{\"target\":\"%s\",\"frequencyHz\":1000000,\"cycles\":%llu,\"edges\":%u,\"badEdgeIntervals\":%u,\"highCycles\":%u,\"lowCycles\":%u,\"inputMirrorChecks\":%u,\"firstEdges\":[",argv[1],(unsigned long long)cpu->cycle,edges,bad,high,low,input_checks);
 for(unsigned i=0;i<sample_count;i++)printf("%s%llu",i?",":"",(unsigned long long)samples[i]);puts("]}");
 avr_terminate(cpu);return edges>=10000&&bad==0?0:5;
}
